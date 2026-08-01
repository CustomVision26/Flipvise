"use server";

import { Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireEssayAddonAccess } from "@/lib/essay-access";
import { currentUser } from "@/lib/clerk-auth";
import { formatApaTitlePageDate } from "@/lib/essay-apa-student-paper";
import {
  runWithAiUsageContext,
  trackedGenerateText,
} from "@/lib/ai-usage/track";
import {
  isAiAccessDisabledError,
  isAiUsageLimitError,
} from "@/lib/ai-usage/errors";
import {
  essayDraftBodySchema,
  essayFeedbackAiOutputSchema,
  essayFeedbackRequestSchema,
  essayGenerateInputSchema,
  essayGenerationResultSchema,
  essaySectionSplitRequestSchema,
  essaySectionSplitResultSchema,
  essaySubmitSchema,
  essayTopicMatchRequestSchema,
  essayTopicMatchResultSchema,
  type EssayFeedbackResult,
  type EssayGenerationResult,
  type EssayGenerateInput,
  type EssaySectionsContent,
} from "@/lib/essay-ai-schema";
import {
  averageCriterionScores,
  buildEssayFeedbackPrompt,
  buildFallbackEssayFeedback,
} from "@/lib/essay-feedback-prompt";
import {
  essayGeneratorPrefillFromInput,
  heuristicEssayTopicMatch,
  type EssayTopicMatchResult,
} from "@/lib/essay-topic-match";
import { essayTypeSupportsStance } from "@/lib/essay-types";
import { complexityToDifficultyLevel } from "@/lib/essay-builder-options";
import {
  buildEssayGeneratePrompt,
  coerceGeneratedResult,
  fallbackEssayResult,
} from "@/lib/essay-generate-prompt";
import {
  createEssayAssignment,
  createEssayDocument,
  createEssayFeedback,
  deleteEssayDocumentForOwner,
  getEssayDocumentByIdForUser,
  getEssayDraftForUser,
  getLatestEssayFeedbackForDraft,
  recordEssayUsageEvent,
  renameEssayDocumentForOwner,
  revealModelEssayForOwner,
  reopenEssayDraftForEdit,
  submitEssayDraft,
  updateEssayDocumentInstructionsForOwner,
  updateEssayDocumentStudioForOwner,
  upsertEssayDraft,
} from "@/db/queries/essays";
import {
  countWordsInSectionsContent,
  distributeEssayTextAcrossSections,
  joinSectionsContent,
  normalizeEssayGenerationResult,
  refineConclusionBoundary,
  resolveEssaySectionsContent,
  syncEssaySectionsFromOutline,
} from "@/lib/essay-result-normalize";
import {
  normalizeDocumentStudioMeta,
} from "@/lib/document-generation-studio";
import { formattingDefaultsForCitationStyle } from "@/lib/essay-citation-style-prompt";
import { ESSAY_CITATION_VALUES } from "@/lib/essay-builder-options";
import { extractTextFromFile } from "@/lib/document-extract";
import {
  applyEssayCitationFormatSchema,
  essayCitationApplyResultSchema,
} from "@/lib/essay-citation-apply-schema";
import {
  buildEssayCitationApplyPrompt,
  filterReferencesToCitedOnly,
  resolveEssayCopyForCitationFormat,
} from "@/lib/essay-citation-apply-prompt";
import {
  getTeamById,
  getTeamsForTeamDashboard,
  listTeamMembers,
} from "@/db/queries/teams";

function sanitizeEssayText(value: string): string {
  return value.replace(/\0/g, "").trim();
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function tokensFromUsage(usage: unknown): number {
  if (!usage || typeof usage !== "object") return 0;
  const u = usage as Record<string, unknown>;
  const total =
    (typeof u.totalTokens === "number" && u.totalTokens) ||
    (typeof u.total_tokens === "number" && u.total_tokens) ||
    0;
  if (total > 0) return total;
  const prompt =
    (typeof u.promptTokens === "number" && u.promptTokens) ||
    (typeof u.inputTokens === "number" && u.inputTokens) ||
    0;
  const completion =
    (typeof u.completionTokens === "number" && u.completionTokens) ||
    (typeof u.outputTokens === "number" && u.outputTokens) ||
    0;
  return prompt + completion;
}

export async function generateEssayAction(
  data: z.input<typeof essayGenerateInputSchema>,
): Promise<never> {
  const access = await requireEssayAddonAccess("action");
  const parsed = essayGenerateInputSchema.safeParse({
    ...data,
    subject: sanitizeEssayText(data.subject ?? ""),
    gradeLevel: sanitizeEssayText(data.gradeLevel ?? ""),
    topic: sanitizeEssayText(data.topic ?? ""),
    learningStandard: sanitizeEssayText(data.learningStandard ?? ""),
  });
  if (!parsed.success) throw new Error("Invalid essay generation input");

  const documentStudio = normalizeDocumentStudioMeta(
    parsed.data.documentStudio,
    parsed.data.citationStyle,
  );

  const generationInput = {
    ...parsed.data,
    essayStance: essayTypeSupportsStance(parsed.data.essayType)
      ? parsed.data.essayStance
      : null,
    difficultyLevel: complexityToDifficultyLevel(parsed.data.complexity),
    citationStyle: documentStudio.essayFormatting.citationStyle,
    documentStudio,
  };

  let result: EssayGenerationResult = fallbackEssayResult(generationInput);
  let tokensUsed = 0;

  if (process.env.OPENAI_API_KEY) {
    try {
      const generated = await runWithAiUsageContext(
        {
          userId: access.userId,
          feature: "essay",
          teamId: null,
          subscriptionPlan: access.effectivePlanSlug,
          isPlatformAdmin: access.isAdmin || access.isSuperadmin,
        },
        () =>
          trackedGenerateText({
            model: openai("gpt-4o"),
            output: Output.object({ schema: essayGenerationResultSchema }),
            prompt: buildEssayGeneratePrompt(generationInput),
          }),
      );
      result = coerceGeneratedResult(generated.output, generationInput);
      tokensUsed = tokensFromUsage(generated.usage);
    } catch (error) {
      if (isAiUsageLimitError(error) || isAiAccessDisabledError(error)) {
        throw new Error(error.message);
      }
      console.error("[generateEssayAction] AI generation failed:", error);
      result = fallbackEssayResult(generationInput);
    }
  }

  const doc = await createEssayDocument({
    userId: access.userId,
    title: result.title.slice(0, 512),
    subject: generationInput.subject,
    gradeLevel: generationInput.gradeLevel,
    essayType: generationInput.essayType,
    difficultyLevel: generationInput.difficultyLevel,
    topic: generationInput.topic,
    learningStandard: generationInput.learningStandard,
    wordCountTarget: generationInput.wordCount,
    timeLimitMinutes: generationInput.timeLimitMinutes,
    generationInput,
    result,
  });

  await recordEssayUsageEvent({
    userId: access.userId,
    eventType: "essay_generated",
    documentId: doc.id,
    tokensUsed,
  });

  revalidatePath("/dashboard/ai-doc-studio/ai-essay");
  revalidatePath("/dashboard/ai-doc-studio/ai-essay/my-essays");
  // Navigate via server redirect — avoids Next.js App Router
  // "Rendered more hooks than during the previous render" when
  // client code calls router.push() immediately after a Server Action.
  redirect(`/dashboard/ai-doc-studio/ai-essay/${doc.id}`);
}

export async function saveEssayDraftAction(
  data: z.infer<typeof essayDraftBodySchema>,
) {
  const access = await requireEssayAddonAccess("action");
  const parsed = essayDraftBodySchema.safeParse({
    ...data,
    body: data.body.replace(/\0/g, ""),
  });
  if (!parsed.success) throw new Error("Invalid draft input");

  const doc = await getEssayDocumentByIdForUser(
    parsed.data.documentId,
    access.userId,
  );
  if (!doc) throw new Error("Essay not found.");

  const wordCount =
    parsed.data.wordCount > 0
      ? parsed.data.wordCount
      : countWords(parsed.data.body);

  const draft = await upsertEssayDraft({
    documentId: parsed.data.documentId,
    userId: access.userId,
    body: parsed.data.body,
    wordCount,
    sectionsContent: parsed.data.sectionsContent ?? {},
  });

  await recordEssayUsageEvent({
    userId: access.userId,
    eventType: "draft_saved",
    documentId: doc.id,
    draftId: draft.id,
  });

  revalidatePath("/dashboard/ai-doc-studio/ai-essay/drafts");
  revalidatePath(`/dashboard/ai-doc-studio/ai-essay/${doc.id}`);
  return { draftId: draft.id, wordCount: draft.wordCount };
}

const reopenEssayForEditSchema = z.object({
  documentId: z.number().int().positive(),
});

/** Reopen a submitted essay so the student can edit and re-submit. */
export async function reopenEssayForEditAction(
  data: z.infer<typeof reopenEssayForEditSchema>,
) {
  const access = await requireEssayAddonAccess("action");
  const parsed = reopenEssayForEditSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid essay");

  const doc = await getEssayDocumentByIdForUser(
    parsed.data.documentId,
    access.userId,
  );
  if (!doc) throw new Error("Essay not found.");

  const draft = await reopenEssayDraftForEdit({
    documentId: parsed.data.documentId,
    userId: access.userId,
  });

  revalidatePath("/dashboard/ai-doc-studio/ai-essay/drafts");
  revalidatePath("/dashboard/ai-doc-studio/ai-essay/my-essays");
  revalidatePath(`/dashboard/ai-doc-studio/ai-essay/${doc.id}`);
  return { draftId: draft.id, status: draft.status as "draft" | "submitted" };
}

export async function submitEssayAction(
  data: z.infer<typeof essaySubmitSchema>,
) {
  const access = await requireEssayAddonAccess("action");
  const parsed = essaySubmitSchema.safeParse({
    ...data,
    body: sanitizeEssayText(data.body),
  });
  if (!parsed.success) throw new Error("Invalid submission");

  const doc = await getEssayDocumentByIdForUser(
    parsed.data.documentId,
    access.userId,
  );
  if (!doc) throw new Error("Essay not found.");

  const wordCount =
    parsed.data.wordCount > 0
      ? parsed.data.wordCount
      : countWords(parsed.data.body);

  // Submit only persists student writing on the draft — never touches
  // essay_documents.result.modelEssay / generatedContent (the model essay).
  const draft = await submitEssayDraft({
    documentId: parsed.data.documentId,
    userId: access.userId,
    body: parsed.data.body,
    wordCount,
    sectionsContent: parsed.data.sectionsContent ?? {},
  });

  // Keep the latest AI feedback linked to this draft (same draft id across upserts).
  const latestFeedback = await getLatestEssayFeedbackForDraft(
    draft.id,
    access.userId,
  );

  await recordEssayUsageEvent({
    userId: access.userId,
    eventType: "essay_submitted",
    documentId: doc.id,
    draftId: draft.id,
  });

  revalidatePath("/dashboard/ai-doc-studio/ai-essay");
  revalidatePath("/dashboard/ai-doc-studio/ai-essay/my-essays");
  revalidatePath("/dashboard/ai-doc-studio/ai-essay/drafts");
  revalidatePath("/dashboard/ai-doc-studio/ai-essay/assignments");
  revalidatePath(`/dashboard/ai-doc-studio/ai-essay/${doc.id}`);
  return {
    draftId: draft.id,
    feedbackSaved: Boolean(latestFeedback),
  };
}

/**
 * Check whether the student's written essay matches the document topic/prompt.
 * Uses a heuristic first; optionally refines with AI when available.
 */
export async function checkEssayTopicMatchAction(
  data: z.infer<typeof essayTopicMatchRequestSchema>,
): Promise<EssayTopicMatchResult> {
  const access = await requireEssayAddonAccess("action");
  const parsed = essayTopicMatchRequestSchema.safeParse({
    ...data,
    body: sanitizeEssayText(data.body),
  });
  if (!parsed.success) throw new Error("Invalid topic-match input");

  const doc = await getEssayDocumentByIdForUser(
    parsed.data.documentId,
    access.userId,
  );
  if (!doc) throw new Error("Essay not found.");

  const heuristic = heuristicEssayTopicMatch({
    topic: doc.topic || doc.title,
    prompt:
      (doc.result as EssayGenerationResult | null)?.prompt?.trim() ||
      doc.topic ||
      doc.title,
    body: parsed.data.body,
  });

  if (!process.env.OPENAI_API_KEY) return heuristic;

  // If heuristic is clearly matched, skip AI. If mismatched or uncertain, ask AI.
  if (heuristic.matches && heuristic.confidence === "high") {
    return heuristic;
  }

  try {
    const generated = await runWithAiUsageContext(
      {
        userId: access.userId,
        feature: "essay",
        teamId: null,
        subscriptionPlan: access.effectivePlanSlug,
        isPlatformAdmin: access.isAdmin || access.isSuperadmin,
      },
      () =>
        trackedGenerateText({
          model: openai("gpt-4o"),
          output: Output.object({ schema: essayTopicMatchResultSchema }),
          prompt: [
            "Decide whether the student's written essay addresses the assigned topic/prompt.",
            "Return matches=true only when the draft is clearly about the same subject.",
            "If the draft is about a different subject (e.g. remote learning vs e-sports), matches=false.",
            "Be concise in reason. If mismatched, set writingSeemsAbout to a short label of what they wrote about.",
            "",
            `Assigned title/topic: ${doc.title}`,
            `Assigned topic field: ${doc.topic}`,
            `Assigned prompt: ${(doc.result as EssayGenerationResult | null)?.prompt ?? "(none)"}`,
            "",
            "Student writing:",
            parsed.data.body.slice(0, 12_000),
          ].join("\n"),
        }),
    );
    return generated.output;
  } catch (error) {
    if (isAiUsageLimitError(error) || isAiAccessDisabledError(error)) {
      return heuristic;
    }
    console.error("[checkEssayTopicMatchAction] AI check failed:", error);
    return heuristic;
  }
}

/** Prefill payload for Essay Generator from an existing essay document. */
export async function getEssayGeneratorPrefillAction(documentId: number) {
  const access = await requireEssayAddonAccess("action");
  const id = z.number().int().positive().parse(documentId);
  const doc = await getEssayDocumentByIdForUser(id, access.userId);
  if (!doc) throw new Error("Essay not found.");

  const input = doc.input as EssayGenerateInput;
  return {
    documentId: doc.id,
    title: doc.title,
    prefill: essayGeneratorPrefillFromInput(input, { title: doc.title }),
  };
}

function fallbackFeedback(
  body: string,
  wordCountTarget = 300,
  wordCount?: number,
): EssayFeedbackResult {
  return buildFallbackEssayFeedback({
    body,
    wordCount: wordCount ?? countWords(body),
    wordCountTarget,
  });
}

export async function generateEssayFeedbackAction(
  data: z.infer<typeof essayFeedbackRequestSchema>,
): Promise<EssayFeedbackResult> {
  const access = await requireEssayAddonAccess("action");
  const parsed = essayFeedbackRequestSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid feedback request");

  const doc = await getEssayDocumentByIdForUser(
    parsed.data.documentId,
    access.userId,
  );
  if (!doc) throw new Error("Essay not found.");

  const draft = await getEssayDraftForUser(
    parsed.data.documentId,
    access.userId,
  );
  if (!draft || !draft.body.trim()) {
    throw new Error("Save or submit an essay before requesting feedback.");
  }

  const resultDoc = normalizeEssayGenerationResult(doc.result);
  const essayBody =
    draft.body.trim() ||
    joinSectionsContent(
      resultDoc.sections,
      (draft.sectionsContent as Record<string, string> | null) ?? {},
    );

  let result = fallbackFeedback(
    essayBody,
    doc.wordCountTarget,
    draft.wordCount,
  );
  let tokensUsed = 0;

  if (process.env.OPENAI_API_KEY) {
    try {
      const generated = await runWithAiUsageContext(
        {
          userId: access.userId,
          feature: "essay",
          teamId: null,
          subscriptionPlan: access.effectivePlanSlug,
          isPlatformAdmin: access.isAdmin || access.isSuperadmin,
        },
        () =>
          trackedGenerateText({
            model: openai("gpt-4o"),
            output: Output.object({ schema: essayFeedbackAiOutputSchema }),
            prompt: buildEssayFeedbackPrompt({
              title: doc.title,
              prompt: resultDoc.prompt,
              thesis: resultDoc.thesis,
              wordCountTarget: doc.wordCountTarget,
              studentWordCount: draft.wordCount,
              studentEssay: essayBody,
              result: resultDoc,
            }),
          }),
      );
      const out = generated.output;
      if (!out) {
        result = fallbackFeedback(
          essayBody,
          doc.wordCountTarget,
          draft.wordCount,
        );
      } else {
        const { criterionScores, ...rest } = out;
        result = {
          ...rest,
          overallScore: averageCriterionScores(criterionScores),
        };
      }
      tokensUsed = tokensFromUsage(generated.usage);
    } catch (error) {
      if (isAiUsageLimitError(error) || isAiAccessDisabledError(error)) {
        throw new Error(error.message);
      }
      console.error("[generateEssayFeedbackAction] AI feedback failed:", error);
      result = fallbackFeedback(
        essayBody,
        doc.wordCountTarget,
        draft.wordCount,
      );
    }
  }

  await createEssayFeedback({
    documentId: doc.id,
    draftId: draft.id,
    userId: access.userId,
    result,
  });

  await recordEssayUsageEvent({
    userId: access.userId,
    eventType: "ai_feedback_generated",
    documentId: doc.id,
    draftId: draft.id,
    tokensUsed,
  });

  revalidatePath(`/dashboard/ai-doc-studio/ai-essay/${doc.id}`);
  revalidatePath("/dashboard/ai-doc-studio/ai-essay");
  return result;
}

export async function revealModelEssayAction(documentId: number) {
  const access = await requireEssayAddonAccess("action");
  const parsed = z.number().int().positive().safeParse(documentId);
  if (!parsed.success) throw new Error("Invalid document id");

  const row = await revealModelEssayForOwner(parsed.data, access.userId);
  if (!row) throw new Error("Essay not found or you are not the owner.");

  await recordEssayUsageEvent({
    userId: access.userId,
    eventType: "model_essay_revealed",
    documentId: row.id,
  });

  revalidatePath(`/dashboard/ai-doc-studio/ai-essay/${row.id}`);
  return { revealed: true as const };
}

export async function getEssayWorkspaceDataAction(documentId: number) {
  const access = await requireEssayAddonAccess("action");
  const doc = await getEssayDocumentByIdForUser(documentId, access.userId);
  if (!doc) throw new Error("Essay not found.");
  const draft = await getEssayDraftForUser(documentId, access.userId);
  const feedback = draft
    ? await getLatestEssayFeedbackForDraft(draft.id, access.userId)
    : null;
  return {
    document: doc,
    draft,
    feedback,
    isOwner: doc.userId === access.userId,
  };
}

const assignEssaySchema = z.object({
  documentId: z.number().int().positive(),
  teamId: z.number().int().positive(),
  assigneeUserId: z.string().min(1),
});

/** Team Admin assigns an owned essay activity to a workspace member. */
export async function assignEssayToMemberAction(
  data: z.infer<typeof assignEssaySchema>,
) {
  const access = await requireEssayAddonAccess("action");
  const parsed = assignEssaySchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid assignment input");

  const manageable = await getTeamsForTeamDashboard(access.userId);
  if (!manageable.some((t) => t.id === parsed.data.teamId)) {
    throw new Error("You cannot assign essays for this workspace.");
  }

  const doc = await getEssayDocumentByIdForUser(
    parsed.data.documentId,
    access.userId,
  );
  if (!doc || doc.userId !== access.userId) {
    throw new Error("Only the essay owner can assign this activity.");
  }

  const team = await getTeamById(parsed.data.teamId);
  if (!team) throw new Error("Workspace not found.");
  const members = await listTeamMembers(parsed.data.teamId);
  const member = members.find((m) => m.userId === parsed.data.assigneeUserId);
  if (!member && team.ownerUserId !== parsed.data.assigneeUserId) {
    throw new Error("Assignee is not in this workspace.");
  }

  await createEssayAssignment({
    teamId: parsed.data.teamId,
    documentId: parsed.data.documentId,
    assigneeUserId: parsed.data.assigneeUserId,
    assignedByUserId: access.userId,
  });

  revalidatePath("/dashboard/ai-doc-studio/ai-essay/assignments");
  revalidatePath(`/dashboard/ai-doc-studio/ai-essay/${parsed.data.documentId}`);
}

const renameEssayDocumentSchema = z.object({
  documentId: z.number().int().positive(),
  title: z.string().min(1).max(512),
});

const essayDocumentIdSchema = z.object({
  documentId: z.number().int().positive(),
});

export async function renameEssayDocumentAction(
  data: z.infer<typeof renameEssayDocumentSchema>,
) {
  const access = await requireEssayAddonAccess("action");
  const parsed = renameEssayDocumentSchema.safeParse({
    ...data,
    title: sanitizeEssayText(data.title),
  });
  if (!parsed.success) throw new Error("Invalid rename input");

  const row = await renameEssayDocumentForOwner(
    parsed.data.documentId,
    access.userId,
    parsed.data.title,
  );
  if (!row) throw new Error("Essay not found or you cannot rename it.");

  revalidatePath("/dashboard/ai-doc-studio/ai-essay");
  revalidatePath("/dashboard/ai-doc-studio/ai-essay/my-essays");
  revalidatePath("/dashboard/ai-doc-studio/ai-essay/drafts");
  revalidatePath(`/dashboard/ai-doc-studio/ai-essay/${row.id}`);
  return { documentId: row.id, title: row.title };
}

export async function deleteEssayDocumentAction(
  data: z.infer<typeof essayDocumentIdSchema>,
) {
  const access = await requireEssayAddonAccess("action");
  const parsed = essayDocumentIdSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid delete input");

  const ok = await deleteEssayDocumentForOwner(
    parsed.data.documentId,
    access.userId,
  );
  if (!ok) throw new Error("Essay not found or you cannot delete it.");

  revalidatePath("/dashboard/ai-doc-studio/ai-essay");
  revalidatePath("/dashboard/ai-doc-studio/ai-essay/my-essays");
  revalidatePath("/dashboard/ai-doc-studio/ai-essay/drafts");
  revalidatePath("/dashboard/ai-doc-studio/ai-essay/assignments");
  return { ok: true as const };
}

function mapSplitPartsToSectionsContent(
  sectionIds: string[],
  parts: Array<{ sectionId: string; text: string }>,
): EssaySectionsContent {
  const next: EssaySectionsContent = {};
  for (const id of sectionIds) next[id] = "";
  for (const part of parts) {
    if (!(part.sectionId in next)) continue;
    const text = part.text.trim();
    if (!text) continue;
    next[part.sectionId] = next[part.sectionId]
      ? `${next[part.sectionId]}\n\n${text}`
      : text;
  }
  return next;
}

/**
 * Use AI to place freeform Writing area text into the correct workspace sections.
 * Falls back to heuristic intro/support/conclusion distribution when AI is unavailable.
 */
export async function splitEssayIntoSectionsAction(
  data: z.infer<typeof essaySectionSplitRequestSchema>,
): Promise<EssaySectionsContent> {
  const access = await requireEssayAddonAccess("action");
  const parsed = essaySectionSplitRequestSchema.safeParse({
    ...data,
    essayText: data.essayText.replace(/\0/g, "").trim(),
  });
  if (!parsed.success) throw new Error("Invalid section-split input");

  const doc = await getEssayDocumentByIdForUser(
    parsed.data.documentId,
    access.userId,
  );
  if (!doc) throw new Error("Essay not found.");

  const sectionIds = parsed.data.sections.map((section) => section.id);
  const fallback = distributeEssayTextAcrossSections(
    parsed.data.sections.map((section) => ({
      id: section.id,
      title: section.title,
      type: section.type,
      instructions: section.instructions,
      sentenceStarters: null,
      examples: null,
      transitionWords: null,
      checklist: null,
      teacherNotes: null,
      estimatedWords: 80,
      generatedContent: null,
      planningGoal: null,
      planningKeyIdea: null,
      planningEvidence: null,
    })),
    parsed.data.essayText,
  );

  if (!process.env.OPENAI_API_KEY) return fallback;

  const sectionCatalog = parsed.data.sections
    .map(
      (section, index) =>
        `${index + 1}. id="${section.id}" | type="${section.type}" | title="${section.title}" | purpose="${section.instructions}"`,
    )
    .join("\n");

  try {
    const generated = await runWithAiUsageContext(
      {
        userId: access.userId,
        feature: "essay",
        teamId: null,
        subscriptionPlan: access.effectivePlanSlug,
        isPlatformAdmin: access.isAdmin || access.isSuperadmin,
      },
      () =>
        trackedGenerateText({
          model: openai("gpt-4o"),
          output: Output.object({ schema: essaySectionSplitResultSchema }),
          prompt: [
            "Split the student's freeform essay into the given writing sections.",
            "Rules:",
            "- Preserve the student's wording; do not rewrite or invent new content.",
            "- Put introduction/opening material in introduction-type sections.",
            "- Put middle narrative/body development in supporting sections (rising action, climax, falling action, analysis, etc.).",
            "- Put ending/reflection material in conclusion/resolution sections.",
            "- CRITICAL: A final sentence that restates the thesis or gives a closing judgment (e.g. \"Schools should keep… because…\", \"In conclusion…\", \"Readers should…\") MUST go in the Conclusion section — even if it currently shares a paragraph with body or counterargument text.",
            "- When the last paragraph mixes body + closer, split at the sentence boundary: body stays in supporting; only the closing sentence(s) go to Conclusion.",
            "- Every section id listed must appear exactly once in parts.",
            "- Use an empty string for a section with no matching text.",
            "- Prefer paragraph boundaries; keep consecutive sentences that belong together unless splitting off a concluding closer.",
            "- Cover the full source essay across the parts (no dropped sentences).",
            "",
            "Sections:",
            sectionCatalog,
            "",
            "Essay text:",
            parsed.data.essayText,
          ].join("\n"),
        }),
    );

    const mapped = refineConclusionBoundary(
      parsed.data.sections.map((section) => ({
        id: section.id,
        title: section.title,
        type: section.type,
        instructions: section.instructions,
        sentenceStarters: null,
        examples: null,
        transitionWords: null,
        checklist: null,
        teacherNotes: null,
        estimatedWords: 80,
        generatedContent: null,
        planningGoal: null,
        planningKeyIdea: null,
        planningEvidence: null,
      })),
      mapSplitPartsToSectionsContent(sectionIds, generated.output.parts),
    );
    const mappedWords = Object.values(mapped).join(" ").trim();
    if (!mappedWords) return fallback;
    return mapped;
  } catch (error) {
    if (isAiUsageLimitError(error) || isAiAccessDisabledError(error)) {
      throw new Error(error.message);
    }
    console.error("[splitEssayIntoSectionsAction] AI split failed:", error);
    return fallback;
  }
}

const updateEssayInstructionsSchema = z.object({
  documentId: z.number().int().positive(),
  title: z.string().min(1).max(512),
  result: essayGenerationResultSchema,
});

export async function updateEssayInstructionsAction(
  data: z.infer<typeof updateEssayInstructionsSchema>,
) {
  const access = await requireEssayAddonAccess("action");
  const parsed = updateEssayInstructionsSchema.safeParse({
    ...data,
    title: sanitizeEssayText(data.title),
  });
  if (!parsed.success) throw new Error("Invalid essay instructions");

  const normalized = normalizeEssayGenerationResult({
    ...parsed.data.result,
    title: parsed.data.title,
    prompt: sanitizeEssayText(parsed.data.result.prompt),
  });
  const synced = syncEssaySectionsFromOutline(normalized);

  const row = await updateEssayDocumentInstructionsForOwner({
    documentId: parsed.data.documentId,
    userId: access.userId,
    title: parsed.data.title,
    result: synced,
  });
  if (!row) {
    throw new Error("Essay not found or you cannot edit these instructions.");
  }

  revalidatePath("/dashboard/ai-doc-studio/ai-essay");
  revalidatePath("/dashboard/ai-doc-studio/ai-essay/my-essays");
  revalidatePath("/dashboard/ai-doc-studio/ai-essay/drafts");
  revalidatePath(`/dashboard/ai-doc-studio/ai-essay/${row.id}`);
  return {
    documentId: row.id,
    title: row.title,
    result: normalizeEssayGenerationResult(row.result),
  };
}

const applyEssayCitationFormatActionSchema = applyEssayCitationFormatSchema;

const saveEssayFormattedPreviewSchema = z.object({
  documentId: z.number().int().positive(),
  bodyTitle: z.string().max(512).optional().default(""),
  bodyText: z.string().max(100_000),
  titlePageText: z.string().max(8_000).nullable(),
  referencesText: z.string().max(50_000),
  referencesNote: z.string().max(2_000).nullable().optional().default(null),
});

/**
 * Save only the Formatted essay preview snapshot into Citation & Formatting → Formatted papers.
 * Does not modify the writing draft or generation result body.
 */
export async function saveEssayFormattedPreviewAction(
  data: z.infer<typeof saveEssayFormattedPreviewSchema>,
) {
  const access = await requireEssayAddonAccess("action");
  const parsed = saveEssayFormattedPreviewSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid preview save request");

  const doc = await getEssayDocumentByIdForUser(
    parsed.data.documentId,
    access.userId,
  );
  if (!doc || doc.userId !== access.userId) {
    throw new Error("Essay not found.");
  }

  const existingInput = (doc.input ?? {}) as Record<string, unknown>;
  const prevStudio = normalizeDocumentStudioMeta(
    existingInput.documentStudio,
    (existingInput.citationStyle as (typeof ESSAY_CITATION_VALUES)[number]) ??
      "none",
  );
  if (prevStudio.essayFormatting.citationStyle === "none") {
    throw new Error(
      "Apply a citation format before saving the formatted preview.",
    );
  }

  const bodyText = sanitizeEssayText(parsed.data.bodyText);
  if (!bodyText) {
    throw new Error("Formatted essay preview has no body text to save.");
  }
  const titlePageText = parsed.data.titlePageText
    ? sanitizeEssayText(parsed.data.titlePageText)
    : null;
  const references = parsed.data.referencesText
    .split(/\n\s*\n/)
    .map((entry) => entry.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
  const savedAt = new Date().toISOString();
  const bodyTitle =
    sanitizeEssayText(parsed.data.bodyTitle || "") || doc.title || "Untitled Essay";

  const generationInput = {
    ...existingInput,
    citationStyle: prevStudio.essayFormatting.citationStyle,
    documentStudio: {
      ...prevStudio,
      essayFormatting: {
        ...prevStudio.essayFormatting,
        citationFormattedSavedAt: savedAt,
        formattedEssayPreview: {
          bodyTitle,
          titlePageText,
          bodyText,
          references,
          referencesNote: parsed.data.referencesNote?.trim() || null,
          savedAt,
        },
      },
    },
  } as Parameters<typeof updateEssayDocumentStudioForOwner>[0]["generationInput"];

  const row = await updateEssayDocumentStudioForOwner({
    documentId: doc.id,
    userId: access.userId,
    generationInput,
  });
  if (!row) throw new Error("Could not save formatted essay preview.");

  revalidatePath("/dashboard/ai-doc-studio/ai-essay/citation-formatting");
  revalidatePath("/dashboard/ai-doc-studio/ai-essay/my-essays");

  return { documentId: row.id, savedAt };
}

/**
 * Apply citation style to a *copy* of the chosen essay (user-written or model).
 * Stores the formatted copy in Formatted essay preview — does not change the
 * original draft, writing workspace, or generation result body.
 */
export async function applyEssayCitationFormatAction(
  data: z.infer<typeof applyEssayCitationFormatActionSchema>,
) {
  const access = await requireEssayAddonAccess("action");
  const parsed = applyEssayCitationFormatActionSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid citation format request");

  const doc = await getEssayDocumentByIdForUser(
    parsed.data.documentId,
    access.userId,
  );
  if (!doc || doc.userId !== access.userId) {
    throw new Error("Essay not found.");
  }

  const existingInput = (doc.input ?? {}) as Record<string, unknown>;
  const prevStudio = normalizeDocumentStudioMeta(
    existingInput.documentStudio,
    (existingInput.citationStyle as (typeof ESSAY_CITATION_VALUES)[number]) ??
      "none",
  );
  const userSourcesText = (parsed.data.userSourcesText ?? "").trim();
  const essayFormatting = {
    ...formattingDefaultsForCitationStyle(
      parsed.data.citationStyle,
      prevStudio.essayFormatting,
    ),
    sourceMode: userSourcesText
      ? ("user_supplied" as const)
      : ("ai_generated" as const),
    userSourcesText,
    includeInTextCitations: true,
    includeReferences: true,
    citationFormattedSavedAt:
      prevStudio.essayFormatting.citationFormattedSavedAt,
    formattedEssayPreview: prevStudio.essayFormatting.formattedEssayPreview,
  };
  const documentStudio = {
    documentType: "essay" as const,
    essayFormatting,
    academicIntegrity: prevStudio.academicIntegrity,
  };

  const result = normalizeEssayGenerationResult(doc.result);
  const draft = await getEssayDraftForUser(doc.id, access.userId);
  const writtenSections = resolveEssaySectionsContent(
    result.sections,
    (draft?.sectionsContent as Record<string, string> | null) ?? {},
    draft?.body ?? "",
    { fallbackText: null },
  );
  const { essayBody, sections } = resolveEssayCopyForCitationFormat({
    source: parsed.data.source,
    result,
    writtenSections,
    draftBody: draft?.body ?? "",
  });

  let citedEssay = essayBody;
  let titlePage: string | null = null;
  let references: string[] = [];
  let referencesNote: string | null = userSourcesText
    ? "References formatted from user-supplied sources."
    : "Sample references (AI-generated for formatting demonstration). Replace with real, verified sources before academic submission.";

  if (process.env.OPENAI_API_KEY) {
    try {
      const generated = await runWithAiUsageContext(
        {
          userId: access.userId,
          feature: "essay",
          teamId: null,
          subscriptionPlan: access.effectivePlanSlug,
          isPlatformAdmin: access.isAdmin || access.isSuperadmin,
        },
        () =>
          trackedGenerateText({
            model: openai("gpt-4o"),
            output: Output.object({ schema: essayCitationApplyResultSchema }),
            prompt: buildEssayCitationApplyPrompt({
              title: doc.title,
              citationStyle: parsed.data.citationStyle,
              essayBody,
              sections,
              userSourcesText,
              documentStudio,
              sourceLabel: parsed.data.source,
            }),
          }),
      );
      const out = generated.output;
      if (out) {
        citedEssay = out.citedEssay.trim();
        titlePage = out.titlePage?.trim() || null;
        references = filterReferencesToCitedOnly(
          citedEssay,
          out.references.map((r) => r.trim()).filter(Boolean),
        );
        referencesNote = out.referencesNote?.trim() || referencesNote;
      }
    } catch (error) {
      if (isAiUsageLimitError(error) || isAiAccessDisabledError(error)) {
        throw new Error(error.message);
      }
      console.error(
        "[applyEssayCitationFormatAction] AI citation apply failed:",
        error,
      );
      throw new Error(
        "Could not build citations and references. Try again in a moment.",
      );
    }
  }

  const bodyText = sanitizeEssayText(citedEssay);
  if (!bodyText) {
    throw new Error("Formatted essay copy has no body text.");
  }
  const savedAt = new Date().toISOString();
  const bodyTitle = doc.title || "Untitled Essay";
  const titlePageText = titlePage ? sanitizeEssayText(titlePage) : null;

  const generationInput = {
    ...existingInput,
    citationStyle: parsed.data.citationStyle,
    sourcesRequired: userSourcesText
      ? Math.max(1, 2)
      : typeof existingInput.sourcesRequired === "number"
        ? existingInput.sourcesRequired
        : 3,
    documentStudio: {
      ...documentStudio,
      essayFormatting: {
        ...essayFormatting,
        formattedEssayPreview: {
          bodyTitle,
          titlePageText,
          bodyText,
          references,
          referencesNote,
          savedAt,
        },
      },
    },
  } as Parameters<typeof updateEssayDocumentStudioForOwner>[0]["generationInput"];

  // Persist formatting metadata + formatted copy only — leave draft & result alone.
  const row = await updateEssayDocumentStudioForOwner({
    documentId: doc.id,
    userId: access.userId,
    generationInput,
  });
  if (!row) throw new Error("Could not save citation format.");

  revalidatePath("/dashboard/ai-doc-studio/ai-essay");
  revalidatePath("/dashboard/ai-doc-studio/ai-essay/citation-formatting");
  revalidatePath("/dashboard/ai-doc-studio/ai-essay/academic-integrity");
  revalidatePath("/dashboard/ai-doc-studio/ai-essay/my-essays");
  revalidatePath(`/dashboard/ai-doc-studio/ai-essay/${row.id}`);

  return {
    documentId: row.id,
    citationStyle: parsed.data.citationStyle,
    source: parsed.data.source,
    preview: {
      bodyTitle,
      titlePageText,
      bodyText,
      references,
      referencesNote,
      savedAt,
    },
  };
}

/** Payload for client-side “View in PDF” from My Essays. */
export async function getEssayDocumentPdfDataAction(
  data: z.infer<typeof essayDocumentIdSchema>,
) {
  const access = await requireEssayAddonAccess("action");
  const parsed = essayDocumentIdSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid essay id");

  const doc = await getEssayDocumentByIdForUser(
    parsed.data.documentId,
    access.userId,
  );
  if (!doc) throw new Error("Essay not found.");

  const draft = await getEssayDraftForUser(doc.id, access.userId);
  const result = normalizeEssayGenerationResult(doc.result);
  // Prefer saved draft writing only — never fall back to the model essay.
  const writtenSections = resolveEssaySectionsContent(
    result.sections,
    (draft?.sectionsContent as Record<string, string> | null) ?? {},
    draft?.body ?? "",
    { fallbackText: null },
  );
  const documentStudio = normalizeDocumentStudioMeta(
    (doc.input as { documentStudio?: unknown } | null)?.documentStudio,
    (doc.input as { citationStyle?: "none" | "apa" | "mla" | "chicago" | "harvard" } | null)
      ?.citationStyle ?? "none",
  );
  const feedback =
    draft != null
      ? await getLatestEssayFeedbackForDraft(draft.id, access.userId)
      : null;

  const user = await currentUser();
  const studentName =
    user?.fullName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    null;
  const courseName =
    [doc.subject, doc.gradeLevel].filter(Boolean).join(" · ") || null;

  return {
    title: doc.title,
    prompt: result.prompt,
    result,
    wordCountTarget: doc.wordCountTarget,
    includeModelEssay: doc.modelEssayRevealed || doc.userId !== access.userId,
    writtenSections,
    documentStudio,
    feedback: feedback?.result ?? null,
    studentName,
    courseName,
    institutionName: null,
    instructorName: null,
    assignmentDate: formatApaTitlePageDate(),
  };
}

/** Reuse Flipvise document extractors for Essay Studio user-supplied sources. */
export async function extractEssayUserSourceAction(formData: FormData) {
  const access = await requireEssayAddonAccess("action");
  void access;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a PDF or DOCX file.");
  }
  const extracted = await extractTextFromFile(file);
  if (!extracted.text.trim()) {
    throw new Error("No readable text found in that file.");
  }
  return {
    text: extracted.text.slice(0, 20_000),
    sourceTitle: extracted.sourceTitle || file.name,
    format: extracted.format,
  };
}
