"use server";

import { Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEssayAddonAccess } from "@/lib/essay-access";
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
  essayFeedbackRequestSchema,
  essayFeedbackResultSchema,
  essayGenerateInputSchema,
  essayGenerationResultSchema,
  essaySubmitSchema,
  type EssayFeedbackResult,
  type EssayGenerationResult,
} from "@/lib/essay-ai-schema";
import {
  createEssayAssignment,
  createEssayDocument,
  createEssayFeedback,
  getEssayDocumentByIdForUser,
  getEssayDraftForUser,
  getLatestEssayFeedbackForDraft,
  recordEssayUsageEvent,
  revealModelEssayForOwner,
  submitEssayDraft,
  upsertEssayDraft,
} from "@/db/queries/essays";
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

function buildEssayGeneratePrompt(
  input: z.infer<typeof essayGenerateInputSchema>,
): string {
  return [
    "Create a complete classroom essay activity for students.",
    `Subject: ${input.subject}`,
    `Grade level: ${input.gradeLevel}`,
    `Essay type: ${input.essayType}`,
    `Difficulty: ${input.difficultyLevel}`,
    `Topic: ${input.topic}`,
    input.learningStandard
      ? `Learning standard: ${input.learningStandard}`
      : "Learning standard: (none provided)",
    `Target word count: ${input.wordCount}`,
    input.timeLimitMinutes > 0
      ? `Suggested time limit: ${input.timeLimitMinutes} minutes`
      : "Suggested time limit: none",
    "",
    "Return:",
    "- A clear essay title",
    "- A student-facing essay prompt",
    "- Learning objectives",
    input.includeOutline
      ? "- A structured essay outline"
      : "- outline must be null",
    input.includeVocabulary
      ? "- Vocabulary terms with short definitions"
      : "- vocabulary must be null",
    "- A planning guide (steps before writing)",
    "- A success checklist",
    input.includeRubric
      ? "- A rubric with criteria and max points"
      : "- rubric must be null",
    input.includeModelEssay
      ? "- A full model essay suitable for teacher review (not shown to students by default)"
      : "- modelEssay must be null",
    "",
    "Keep language age-appropriate. Do not include answer keys in the prompt.",
  ].join("\n");
}

function fallbackEssayResult(
  input: z.infer<typeof essayGenerateInputSchema>,
): EssayGenerationResult {
  return {
    title: `${input.topic} Essay`,
    prompt: `Write a ${input.essayType.replace(/_/g, " ")} essay about "${input.topic}" for ${input.gradeLevel}. Aim for about ${input.wordCount} words.`,
    learningObjectives: [
      `Develop a clear ${input.essayType.replace(/_/g, " ")} response to the topic.`,
      "Organize ideas with an introduction, body paragraphs, and conclusion.",
      "Support claims with relevant details and vocabulary.",
    ],
    outline: input.includeOutline
      ? [
          "Introduction with a clear thesis",
          "Body paragraph 1 — main idea + evidence",
          "Body paragraph 2 — main idea + evidence",
          "Body paragraph 3 — main idea + evidence",
          "Conclusion that restates the thesis",
        ]
      : null,
    vocabulary: input.includeVocabulary
      ? [
          { term: "thesis", definition: "The main claim or controlling idea of an essay." },
          { term: "evidence", definition: "Facts, examples, or details that support a claim." },
          { term: "transition", definition: "A word or phrase that connects ideas smoothly." },
        ]
      : null,
    planningGuide: [
      "Brainstorm ideas related to the topic.",
      "Choose a clear thesis statement.",
      "List supporting details for each body paragraph.",
      "Draft, then revise for clarity and organization.",
    ],
    successChecklist: [
      "Includes an introduction with a thesis",
      "Uses organized body paragraphs",
      "Supports ideas with details",
      "Ends with a conclusion",
      `Meets approximately ${input.wordCount} words`,
    ],
    rubric: input.includeRubric
      ? [
          { name: "Thesis & Focus", description: "Clear controlling idea.", maxPoints: 20 },
          { name: "Organization", description: "Logical structure and transitions.", maxPoints: 20 },
          { name: "Evidence", description: "Relevant supporting details.", maxPoints: 20 },
          { name: "Language", description: "Grammar, vocabulary, and style.", maxPoints: 20 },
          { name: "Conclusion", description: "Effective closing.", maxPoints: 20 },
        ]
      : null,
    modelEssay: input.includeModelEssay
      ? `This is a sample ${input.essayType.replace(/_/g, " ")} essay on "${input.topic}". Teachers can reveal it after students submit. Replace this placeholder when OpenAI is configured.`
      : null,
  };
}

export async function generateEssayAction(
  data: z.infer<typeof essayGenerateInputSchema>,
): Promise<{ documentId: number; result: EssayGenerationResult }> {
  const access = await requireEssayAddonAccess("action");
  const parsed = essayGenerateInputSchema.safeParse({
    ...data,
    subject: sanitizeEssayText(data.subject ?? ""),
    gradeLevel: sanitizeEssayText(data.gradeLevel ?? ""),
    topic: sanitizeEssayText(data.topic ?? ""),
    learningStandard: sanitizeEssayText(data.learningStandard ?? ""),
  });
  if (!parsed.success) throw new Error("Invalid essay generation input");

  let result: EssayGenerationResult = fallbackEssayResult(parsed.data);
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
            prompt: buildEssayGeneratePrompt(parsed.data),
          }),
      );
      result = generated.output;
      tokensUsed = tokensFromUsage(generated.usage);
      if (!parsed.data.includeOutline) result = { ...result, outline: null };
      if (!parsed.data.includeVocabulary) result = { ...result, vocabulary: null };
      if (!parsed.data.includeRubric) result = { ...result, rubric: null };
      if (!parsed.data.includeModelEssay) result = { ...result, modelEssay: null };
    } catch (error) {
      if (isAiUsageLimitError(error) || isAiAccessDisabledError(error)) {
        throw new Error(error.message);
      }
      console.error("[generateEssayAction] AI generation failed:", error);
      result = fallbackEssayResult(parsed.data);
    }
  }

  const doc = await createEssayDocument({
    userId: access.userId,
    title: result.title.slice(0, 512),
    subject: parsed.data.subject,
    gradeLevel: parsed.data.gradeLevel,
    essayType: parsed.data.essayType,
    difficultyLevel: parsed.data.difficultyLevel,
    topic: parsed.data.topic,
    learningStandard: parsed.data.learningStandard,
    wordCountTarget: parsed.data.wordCount,
    timeLimitMinutes: parsed.data.timeLimitMinutes,
    generationInput: parsed.data,
    result,
  });

  await recordEssayUsageEvent({
    userId: access.userId,
    eventType: "essay_generated",
    documentId: doc.id,
    tokensUsed,
  });

  revalidatePath("/dashboard/essay");
  revalidatePath("/dashboard/essay/my-essays");
  return { documentId: doc.id, result };
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
  });

  await recordEssayUsageEvent({
    userId: access.userId,
    eventType: "draft_saved",
    documentId: doc.id,
    draftId: draft.id,
  });

  revalidatePath("/dashboard/essay/drafts");
  revalidatePath(`/dashboard/essay/${doc.id}`);
  return { draftId: draft.id, wordCount: draft.wordCount };
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

  const draft = await submitEssayDraft({
    documentId: parsed.data.documentId,
    userId: access.userId,
    body: parsed.data.body,
    wordCount,
  });

  await recordEssayUsageEvent({
    userId: access.userId,
    eventType: "essay_submitted",
    documentId: doc.id,
    draftId: draft.id,
  });

  revalidatePath("/dashboard/essay");
  revalidatePath("/dashboard/essay/assignments");
  revalidatePath(`/dashboard/essay/${doc.id}`);
  return { draftId: draft.id };
}

function fallbackFeedback(body: string): EssayFeedbackResult {
  const words = countWords(body);
  return {
    overallScore: Math.min(90, 50 + Math.floor(words / 20)),
    strengths: [
      "You produced a complete response to the prompt.",
      "Your draft shows engagement with the topic.",
    ],
    areasForImprovement: [
      "Strengthen topic sentences in each body paragraph.",
      "Add more specific supporting details.",
    ],
    revisionSuggestions: [
      "Revise the introduction so the thesis is unmistakable.",
      "Check transitions between paragraphs.",
      "Proofread for grammar and punctuation.",
    ],
    grammar: "Review sentence boundaries and agreement.",
    organization: "Ensure each paragraph has one clear focus.",
    vocabulary: "Use precise academic vocabulary where appropriate.",
    supportingDetails: "Add examples or explanations for key claims.",
    essayStructure: "Confirm introduction, body, and conclusion are present.",
    introduction: "Open with context and a clear thesis.",
    bodyParagraphs: "Develop each idea with evidence and explanation.",
    conclusion: "Restate the thesis and leave a final thought.",
  };
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

  const draft =
    parsed.data.draftId != null
      ? await getEssayDraftForUser(parsed.data.documentId, access.userId)
      : await getEssayDraftForUser(parsed.data.documentId, access.userId);
  if (!draft || !draft.body.trim()) {
    throw new Error("Save or submit an essay before requesting feedback.");
  }

  let result = fallbackFeedback(draft.body);
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
            output: Output.object({ schema: essayFeedbackResultSchema }),
            prompt: [
              "Evaluate this student essay. Be constructive and specific.",
              `Essay title: ${doc.title}`,
              `Prompt: ${doc.result.prompt}`,
              `Target word count: ${doc.wordCountTarget}`,
              `Student word count: ${draft.wordCount}`,
              "",
              "Student essay:",
              draft.body,
              "",
              "Score overallScore 0–100. Cover grammar, organization, vocabulary, supporting details, structure, introduction, body paragraphs, and conclusion.",
            ].join("\n"),
          }),
      );
      result = generated.output;
      tokensUsed = tokensFromUsage(generated.usage);
    } catch (error) {
      if (isAiUsageLimitError(error) || isAiAccessDisabledError(error)) {
        throw new Error(error.message);
      }
      console.error("[generateEssayFeedbackAction] AI feedback failed:", error);
      result = fallbackFeedback(draft.body);
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

  revalidatePath(`/dashboard/essay/${doc.id}`);
  revalidatePath("/dashboard/essay");
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

  revalidatePath(`/dashboard/essay/${row.id}`);
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

  revalidatePath("/dashboard/essay/assignments");
  revalidatePath(`/dashboard/essay/${parsed.data.documentId}`);
}
