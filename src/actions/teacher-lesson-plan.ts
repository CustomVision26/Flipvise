"use server";

import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAccessContext } from "@/lib/access";
import { requireTeacherToolsAccess } from "@/lib/teacher-access";
import {
  coerceLessonPlanDayVocabularyDetail,
  coerceLessonPlanResultAi,
  lessonPlanDayVocabularyDetailAiSchema,
  lessonPlanInputSchema,
  lessonPlanResultAiSchema,
  lessonPlanResultSchema,
  type LessonPlanActionInput,
  type LessonPlanDayVocabularyDetail,
} from "@/lib/lesson-plan-ai-schema";
import { differentiatedInstructionAiRules, difficultyRigorAiRules, filterDifferentiatedInstruction } from "@/lib/lesson-plan-difficulty";
import {
  fetchCurriculumContextForLessonPlan,
  formatCurriculumContextForPrompt,
  type CurriculumResearchContext,
} from "@/lib/lesson-plan-curriculum-research";
import {
  buildTemplateDayVocabularyDetail,
  parseVocabularyLine,
  sanitizeDayVocabularyDetail,
} from "@/lib/lesson-plan-vocabulary-detail";
import {
  buildTopicVocabularyLines,
  isNonConceptVocabularyTerm,
} from "@/lib/lesson-plan-vocabulary-banks";
import { vocabularyApproachPromptLine } from "@/lib/lesson-plan-vocabulary-approach";
import {
  clampPlanPeriodDays,
  DEFAULT_PLAN_PERIOD_DAYS,
  formatUnitPacingLabel,
  reconcileWeeklySchedule,
  weeklySchedulePromptBlock,
} from "@/lib/lesson-plan-weekly-schedule";
import {
  resolveSavedLessonPlanForViewer,
  saveLessonPlan,
  updateSavedLessonPlanById,
} from "@/db/queries/saved-lesson-plans";
import { createDeck, getDeckRowById } from "@/db/queries/decks";
import { linkDeckToTeamWorkspace, resolveDeckViewerAccess } from "@/db/queries/teams";
import {
  buildTeacherLessonDeckMetadata,
  resolveTeacherQuizSaveTarget,
} from "@/lib/teacher-quiz-deck-save";
import {
  generateLessonPlanPdfBuffer,
  generateLessonPlanVocabularyDetailPdfBuffer,
  lessonPlanHasVocabularyDetails,
  lessonPlanPdfSafeFileName,
  lessonPlanVocabularyDetailPdfSafeFileName,
  type LessonPlanPdfUnitContext,
} from "@/lib/lesson-plan-pdf-build";
import { uploadLessonPlanPdfBufferToS3, deleteFromS3 } from "@/lib/s3";
import {
  extractTextFromFile,
  extractTextFromUrl,
  assertFormatAllowedForPlan,
} from "@/lib/document-extract";
import { canUseAdvancedSourceImport } from "@/lib/source-import-access";
import {
  formatLessonPlanReferenceForPrompt,
  formatMultipleLessonPlanReferencesForPrompt,
  normalizeLessonPlanReferenceMaterial,
  referenceSourceSummaryLabel,
} from "@/lib/lesson-plan-reference-material";
import { isYouTubeUrl, youTubeReferenceSummary } from "@/lib/youtube-url";
import { truncateSourceImportText } from "@/lib/source-import-formats";
import {
  generateLessonPlan,
  type LessonPlanInput,
  type LessonPlanResult,
} from "@/lib/teacher-generators";

const LESSON_PLAN_FIELD_LABELS: Record<string, string> = {
  subject: "Enter a subject.",
  gradeLevel: "Enter a grade level.",
  topic: "Enter a topic.",
  lessonDuration: "Enter a lesson duration.",
  difficultyLevel: "Select a difficulty level.",
};

function lessonPlanValidationError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid input";

  const field = issue.path[0];
  if (typeof field === "string" && LESSON_PLAN_FIELD_LABELS[field]) {
    return LESSON_PLAN_FIELD_LABELS[field];
  }

  if (issue.path[0] === "referenceMaterials") {
    const index = issue.path[1];
    if (issue.path[2] === "summary") {
      return `Reference ${typeof index === "number" ? index + 1 : ""} has a summary that is too long. Remove it and add it again.`.trim();
    }
    if (issue.path[2] === "text") {
      return `Reference ${typeof index === "number" ? index + 1 : ""} is too large. Remove it and add a shorter source.`.trim();
    }
  }

  return issue.message || "Invalid input";
}

function truncateReferenceSummary(summary: string, max = 200): string {
  const trimmed = summary.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function buildLessonPlanPrompt(
  input: LessonPlanActionInput,
  curriculumContext?: CurriculumResearchContext | null,
): string {
  const lines = [
    `Subject: ${input.subject}`,
    `Grade level: ${input.gradeLevel}`,
    `Topic: ${input.topic}`,
    `Lesson duration (one class period): ${input.lessonDuration}`,
    `Plan period: ${input.planPeriodDays} day${input.planPeriodDays === 1 ? "" : "s"} (${formatUnitPacingLabel(input.planPeriodDays, input.lessonDuration)})`,
    `Target difficulty level: ${input.difficultyLevel}`,
  ];

  if (input.learningStandard?.trim()) {
    lines.push(`Learning standard: ${input.learningStandard.trim()}`);
  }
  if (input.classSize?.trim()) {
    lines.push(`Class size: ${input.classSize.trim()} students`);
  }
  if (input.specialInstructions?.trim()) {
    lines.push(
      `Special needs or accommodations: ${input.specialInstructions.trim()}`,
    );
  }
  if (input.referenceMaterials?.length) {
    lines.push(
      "",
      formatMultipleLessonPlanReferencesForPrompt(input.referenceMaterials),
    );
  } else if (input.referenceMaterialText?.trim()) {
    lines.push(
      "",
      formatLessonPlanReferenceForPrompt(
        input.referenceMaterialText,
        input.referenceSourceSummary,
      ),
    );
  }
  if (curriculumContext) {
    lines.push("", formatCurriculumContextForPrompt(curriculumContext));
  }
  if (input.vocabularyTeachingApproach) {
    lines.push("", vocabularyApproachPromptLine(input.vocabularyTeachingApproach));
  }
  lines.push("", weeklySchedulePromptBlock(input.planPeriodDays, input.lessonDuration));
  if (input.regenerationSeed && input.regenerationSeed > 0) {
    lines.push(
      `Variation request #${input.regenerationSeed}: produce a fresh alternative lesson plan with different activities, examples, and sequencing while keeping the same topic and standards.`,
    );
  }

  return lines.join("\n");
}

function sanitizeUnitVocabulary(
  vocabulary: string[],
  input: LessonPlanActionInput,
): string[] {
  const usable = vocabulary.filter((line) => {
    const { term } = parseVocabularyLine(line);
    return !isNonConceptVocabularyTerm(term, input.topic, undefined);
  });

  if (usable.length >= 4) {
    return usable;
  }

  return buildTopicVocabularyLines(
    input.topic,
    input.subject,
    input.difficultyLevel,
  );
}

function normalizeLessonPlanResult(
  output: LessonPlanResult,
  input: LessonPlanActionInput,
): LessonPlanResult {
  const planPeriodDays = clampPlanPeriodDays(input.planPeriodDays);
  const vocabulary = sanitizeUnitVocabulary(output.vocabulary, input);
  const filtered = {
    ...output,
    vocabulary,
    differentiatedInstruction: filterDifferentiatedInstruction(
      output.differentiatedInstruction,
      input.difficultyLevel,
    ),
  };

  if (planPeriodDays <= 1) {
    return { ...filtered, weeklySchedule: undefined };
  }

  const schedule = reconcileWeeklySchedule({
    vocabulary: filtered.vocabulary,
    weeklySchedule: filtered.weeklySchedule,
    planPeriodDays,
    lessonDuration: input.lessonDuration,
    topic: input.topic,
    difficulty: input.difficultyLevel,
  });

  return { ...filtered, weeklySchedule: schedule };
}

function normalizeLessonPlanActionInput(
  data: LessonPlanActionInput,
): LessonPlanActionInput {
  return {
    ...data,
    referenceMaterials: data.referenceMaterials?.map(normalizeLessonPlanReferenceMaterial),
    referenceMaterialText: data.referenceMaterialText
      ? truncateSourceImportText(data.referenceMaterialText)
      : data.referenceMaterialText,
  };
}

export async function generateLessonPlanAction(
  data: LessonPlanActionInput,
): Promise<LessonPlanResult> {
  const ctx = await getAccessContext();
  await requireTeacherToolsAccess(
    ctx,
    "Lesson Builder requires an education plan.",
  );

  const parsed = lessonPlanInputSchema.safeParse(normalizeLessonPlanActionInput(data));
  if (!parsed.success) {
    throw new Error(lessonPlanValidationError(parsed.error));
  }

  const input = parsed.data;

  let curriculumContext: CurriculumResearchContext | null = null;
  if (input.learningStandard?.trim()) {
    try {
      curriculumContext = await fetchCurriculumContextForLessonPlan(input);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[generateLessonPlanAction] Curriculum research failed; continuing without it.",
          error,
        );
      }
      curriculumContext = null;
    }
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return generateLessonPlan(input);
  }

  try {
    const { output } = await generateText({
      model: openai("gpt-4o"),
      output: Output.object({
        schema: lessonPlanResultAiSchema,
      }),
      system: `You are an expert K–12 curriculum designer. Create detailed, classroom-ready lesson plans teachers can use immediately.

Requirements:
- Write specific, in-depth content — never generic placeholders like "term A", "key concept 1", or "sample problem".
- Vocabulary must list real subject-specific concepts students will learn for the topic (e.g. for Algebra 1: Variable, Equation, Coefficient — not the lesson title). Format each entry as "Term — concise student-friendly definition" (6–10 terms).
- Never use the lesson topic, lesson title, or generic labels like "Process", "Cause and effect", or "Vocabulary" as vocabulary terms.
- Learning objectives must be measurable and grade-appropriate (use action verbs: explain, analyze, model, compare, evaluate).
- Materials must be practical and specific to the lesson activities.
- Main teaching steps must be detailed procedural steps a teacher can follow (5–8 steps).
- Warm-up, classroom activity, homework, and assessment must be concrete and topic-specific.
- Lesson timeline must break the full lesson duration into timed segments that add up logically.
${weeklySchedulePromptBlock(input.planPeriodDays, input.lessonDuration)}
${difficultyRigorAiRules(input.difficultyLevel)}
${differentiatedInstructionAiRules(input.difficultyLevel)}
- Never use outdated labels like "On-level", "Support", or "Extension".
- If special needs or accommodations are provided, weave specific adaptations into differentiated instruction and teacher notes.
- If a learning standard is provided, align objectives, vocabulary, assessment, and pacing to that framework.
${curriculumContext ? "- Official curriculum / syllabus research is included in the user prompt. Treat it as authoritative grounding — cite applicable standard codes, competencies, and syllabus outcomes in learning objectives and assessment where relevant." : ""}
${input.vocabularyTeachingApproach ? "- Follow the vocabulary teaching approach specified in the user prompt. Reflect it in vocabulary entries, lesson timeline, activities, homework, and teacher notes." : ""}
${input.referenceMaterials?.length || input.referenceMaterialText?.trim() ? "- Teacher-provided reference material is included in the user prompt. Ground objectives, vocabulary, teaching steps, activities, and assessment in that content when it aligns with the topic." : ""}
- Do not use markdown formatting.`,
      prompt: buildLessonPlanPrompt(input, curriculumContext),
    });

    if (!output) {
      throw new Error("AI lesson generation returned no output.");
    }

    return normalizeLessonPlanResult(coerceLessonPlanResultAi(output), input);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[generateLessonPlanAction] AI failed; using template fallback.",
        error,
      );
    }
    return generateLessonPlan(input);
  }
}

const generateDayVocabularyDetailSchema = z.object({
  subject: z.string().min(1),
  gradeLevel: z.string().min(1),
  topic: z.string().min(1),
  difficultyLevel: lessonPlanInputSchema.shape.difficultyLevel,
  learningStandard: z.string().optional(),
  lessonTitle: z.string().min(1),
  dayLabel: z.string().min(1),
  dailyFocus: z.string().min(1),
  vocabulary: z.array(z.string().min(1)).min(1).max(8),
});

async function generateDayVocabularyDetailCore(
  input: z.infer<typeof generateDayVocabularyDetailSchema>,
) {
  const finalize = (detail: LessonPlanDayVocabularyDetail) =>
    sanitizeDayVocabularyDetail(detail, input);

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return finalize(buildTemplateDayVocabularyDetail(input));
  }

  const vocabularyLines = input.vocabulary
    .map((line) => {
      const { term, shortDefinition } = parseVocabularyLine(line);
      return `- ${term}: ${shortDefinition}`;
    })
    .join("\n");

  try {
    const { output } = await generateText({
      model: openai("gpt-4o"),
      output: Output.object({
        schema: lessonPlanDayVocabularyDetailAiSchema,
      }),
      system: `You are an expert K–12 curriculum writer. Expand a lesson day's vocabulary into classroom-ready teacher reference material.

Requirements:
- Write specific, accurate content for the subject, grade, topic, and learning standard (when provided).
- terms: prefer real subject-domain concepts students will be taught (e.g. Variable, Equation, Coefficient for Algebra). shortDefinition is the concise student-friendly meaning; definition is a fuller classroom explanation (2–4 sentences); example is a concrete italic-ready classroom example starting with "Example:".
- If an assigned vocabulary line is the lesson topic/title or a generic meta-term (Process, Cause and effect, Evidence-as-filler, "main concept"), REPLACE it with authentic domain vocabulary for the topic instead of echoing it.
- Keep roughly the same number of day terms as assigned (typically 1–6), but every term must be a teachable subject concept.
- mainConcept: a "Main Concept" section explaining how the day's terms connect to the topic (like a study guide overview).
- process: numbered instructional steps (Collect, Organize, Display, Analyze, Interpret, etc. when appropriate) with bullet sub-points — match the rigor of ${input.difficultyLevel}.
- learningGoal: "By the end of this class period, students should be able to:" plus measurable objectives.
- additionalVocabulary: 6–12 related subject concepts students should know for this topic/day (PEP/exam-aligned when learning standard mentions Jamaica PEP or similar) — list real terms with definitions like a study guide vocabulary list, not the lesson title.
- contextIntro: one sentence framing the detail section for teachers.
- Never use markdown. Use plain text only.`,
      prompt: [
        `Lesson: ${input.lessonTitle}`,
        `Subject: ${input.subject}`,
        `Grade: ${input.gradeLevel}`,
        `Topic: ${input.topic}`,
        `Difficulty: ${input.difficultyLevel}`,
        input.learningStandard?.trim()
          ? `Learning standard: ${input.learningStandard.trim()}`
          : null,
        `Day: ${input.dayLabel}`,
        `Daily focus: ${input.dailyFocus}`,
        "",
        "Assigned vocabulary for this day:",
        vocabularyLines,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    if (!output) {
      throw new Error("AI vocabulary detail generation returned no output.");
    }

    return finalize(coerceLessonPlanDayVocabularyDetail(output));
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[generateDayVocabularyDetailAction] AI failed; using template fallback.",
        error,
      );
    }
    return finalize(buildTemplateDayVocabularyDetail(input));
  }
}

export async function generateDayVocabularyDetailAction(
  data: z.infer<typeof generateDayVocabularyDetailSchema>,
) {
  const ctx = await getAccessContext();
  await requireTeacherToolsAccess(
    ctx,
    "Lesson Builder requires an education plan.",
  );

  const parsed = generateDayVocabularyDetailSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(lessonPlanValidationError(parsed.error));
  }

  return generateDayVocabularyDetailCore(parsed.data);
}

const generateAllDaysVocabularyDetailSchema = z.object({
  subject: z.string().min(1),
  gradeLevel: z.string().min(1),
  topic: z.string().min(1),
  difficultyLevel: lessonPlanInputSchema.shape.difficultyLevel,
  learningStandard: z.string().optional(),
  lessonTitle: z.string().min(1),
  days: z
    .array(
      z.object({
        dayLabel: z.string().min(1),
        dailyFocus: z.string().min(1),
        vocabulary: z.array(z.string().min(1)).min(1).max(8),
      }),
    )
    .min(1)
    .max(7),
});

export async function generateAllDaysVocabularyDetailAction(
  data: z.infer<typeof generateAllDaysVocabularyDetailSchema>,
) {
  const ctx = await getAccessContext();
  await requireTeacherToolsAccess(
    ctx,
    "Lesson Builder requires an education plan.",
  );

  const parsed = generateAllDaysVocabularyDetailSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(lessonPlanValidationError(parsed.error));
  }

  const { days, ...lessonContext } = parsed.data;

  return Promise.all(
    days.map((day) =>
      generateDayVocabularyDetailCore({
        ...lessonContext,
        dayLabel: day.dayLabel,
        dailyFocus: day.dailyFocus,
        vocabulary: day.vocabulary,
      }),
    ),
  );
}

const saveLessonPlanSchema = z.object({
  input: lessonPlanInputSchema.omit({
    regenerationSeed: true,
    referenceMaterialText: true,
    referenceSourceSummary: true,
    vocabularyTeachingApproach: true,
  }),
  result: lessonPlanResultSchema,
  deckId: z.number().int().positive().optional(),
  newDeckName: z.string().min(1).max(255).optional(),
  teamId: z.number().int().positive().optional(),
});

async function resolveLessonPlanDeckTarget(
  userId: string,
  payload: {
    deckId?: number;
    newDeckName?: string;
    teamId?: number;
    input: LessonPlanInput;
  },
): Promise<{ deckId: number; sourceDeckName: string }> {
  if (payload.deckId != null) {
    const deck = await getDeckRowById(payload.deckId);
    if (!deck) {
      throw new Error("Deck not found.");
    }
    const access = await resolveDeckViewerAccess(payload.deckId, userId);
    if (!access) {
      throw new Error("You do not have access to that deck.");
    }
    return { deckId: payload.deckId, sourceDeckName: deck.name };
  }

  if (payload.newDeckName?.trim()) {
    const saveTarget = await resolveTeacherQuizSaveTarget(userId, payload.teamId);
    if (saveTarget.needsWorkspace) {
      throw new Error(
        `Create an ${saveTarget.planLabel} workspace in Team Admin before creating decks.`,
      );
    }
    if (saveTarget.maxDecks > 0 && saveTarget.deckCount >= saveTarget.maxDecks) {
      const scopeLabel =
        saveTarget.scope === "workspace" ? "workspace" : "personal";
      throw new Error(
        `Deck limit reached — up to ${saveTarget.maxDecks} ${scopeLabel} deck(s) on your ${saveTarget.planLabel} plan.`,
      );
    }

    const { name, description } = buildTeacherLessonDeckMetadata({
      name: payload.newDeckName.trim(),
      subject: payload.input.subject,
      topic: payload.input.topic,
      gradeLevel: payload.input.gradeLevel,
      difficultyLevel: payload.input.difficultyLevel,
    });

    const deckId = await createDeck(
      saveTarget.deckOwnerUserId,
      name,
      description,
      saveTarget.teamId,
      null,
      payload.input.gradeLevel,
      payload.input.difficultyLevel,
      userId,
    );

    if (saveTarget.teamId != null) {
      await linkDeckToTeamWorkspace(saveTarget.teamId, deckId);
    }

    return { deckId, sourceDeckName: name };
  }

  throw new Error("Select an existing deck or enter a name for a new deck.");
}

async function tryUploadLessonPlanVocabularyDetailPdf(
  userId: string,
  result: LessonPlanResult,
  unitContext: LessonPlanPdfUnitContext,
): Promise<{
  vocabularyDetailPdfUrl: string | null;
  vocabularyDetailPdfFileName: string | null;
}> {
  if (!lessonPlanHasVocabularyDetails(result)) {
    return { vocabularyDetailPdfUrl: null, vocabularyDetailPdfFileName: null };
  }

  try {
    const buffer = await generateLessonPlanVocabularyDetailPdfBuffer(
      result,
      unitContext,
    );
    if (!buffer) {
      return { vocabularyDetailPdfUrl: null, vocabularyDetailPdfFileName: null };
    }

    const vocabularyDetailPdfFileName = `${lessonPlanVocabularyDetailPdfSafeFileName(result.lessonTitle)}.pdf`;
    const vocabularyDetailPdfUrl = await uploadLessonPlanPdfBufferToS3({
      userId,
      fileName: vocabularyDetailPdfFileName,
      buffer,
    });

    return { vocabularyDetailPdfUrl, vocabularyDetailPdfFileName };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[teacher-lesson-plan] Vocabulary detail PDF upload skipped or failed.",
        error,
      );
    }
    return { vocabularyDetailPdfUrl: null, vocabularyDetailPdfFileName: null };
  }
}

export async function extractLessonPlanReferenceAction(
  formData: FormData,
): Promise<{ text: string; summary: string }> {
  const ctx = await getAccessContext();
  await requireTeacherToolsAccess(
    ctx,
    "Lesson Builder requires an education plan.",
  );

  const url = formData.get("url")?.toString().trim() ?? "";
  const fileEntry = formData.get("file");
  const hasFile = fileEntry instanceof File && fileEntry.size > 0;

  if (url && hasFile) {
    throw new Error("Add either a website URL or a file — not both at once.");
  }
  if (!url && !hasFile) {
    throw new Error("Provide a website URL or upload a file.");
  }

  const advancedImport = canUseAdvancedSourceImport({
    hasAiReading: ctx.hasAiReading,
    teamTierProWorkspace: ctx.activeEducationTeamPlan !== null,
  });

  if (url) {
    assertFormatAllowedForPlan("url", advancedImport);
    const extracted = await extractTextFromUrl(url);
    const summary = truncateReferenceSummary(
      isYouTubeUrl(url)
        ? youTubeReferenceSummary(url, extracted.sourceTitle)
        : extracted.sourceTitle
          ? `${extracted.sourceTitle} (website)`
          : referenceSourceSummaryLabel("url", { url }),
    );
    return {
      text: truncateSourceImportText(extracted.text),
      summary,
    };
  }

  const file = fileEntry as File;
  const extracted = await extractTextFromFile(file);
  assertFormatAllowedForPlan(extracted.format, advancedImport);
  return {
    text: truncateSourceImportText(extracted.text),
    summary: truncateReferenceSummary(
      referenceSourceSummaryLabel(extracted.format, { fileName: file.name }),
    ),
  };
}

export async function saveLessonPlanAction(data: {
  input: LessonPlanInput;
  result: LessonPlanResult;
  deckId?: number;
  newDeckName?: string;
  teamId?: number;
}): Promise<{
  id: number;
  lessonTitle: string;
  pdfUrl: string | null;
  vocabularyDetailPdfUrl: string | null;
  deckId: number;
  sourceDeckName: string;
}> {
  const ctx = await getAccessContext();
  const { userId } = await requireTeacherToolsAccess(
    ctx,
    "Lesson Builder requires an education plan.",
  );

  const parsed = saveLessonPlanSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid lesson plan data");
  }

  const deckTarget = await resolveLessonPlanDeckTarget(userId, parsed.data);

  let pdfUrl: string | null = null;
  let pdfFileName: string | null = null;
  const unitContext: LessonPlanPdfUnitContext = {
    planPeriodDays: clampPlanPeriodDays(
      parsed.data.input.planPeriodDays ?? DEFAULT_PLAN_PERIOD_DAYS,
    ),
    lessonDuration: parsed.data.input.lessonDuration,
  };

  try {
    const pdfBuffer = await generateLessonPlanPdfBuffer(parsed.data.result, unitContext);
    pdfFileName = `${lessonPlanPdfSafeFileName(parsed.data.result.lessonTitle)}.pdf`;
    pdfUrl = await uploadLessonPlanPdfBufferToS3({
      userId,
      fileName: pdfFileName,
      buffer: pdfBuffer,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[saveLessonPlanAction] PDF upload skipped or failed; saving plan without PDF.",
        error,
      );
    }
  }

  const vocabularyDetailPdf = await tryUploadLessonPlanVocabularyDetailPdf(
    userId,
    parsed.data.result,
    unitContext,
  );

  const saved = await saveLessonPlan({
    userId,
    input: parsed.data.input,
    result: parsed.data.result,
    pdfUrl,
    pdfFileName,
    vocabularyDetailPdfUrl: vocabularyDetailPdf.vocabularyDetailPdfUrl,
    vocabularyDetailPdfFileName: vocabularyDetailPdf.vocabularyDetailPdfFileName,
    deckId: deckTarget.deckId,
    sourceDeckName: deckTarget.sourceDeckName,
  });

  revalidatePath("/teacher/resources");
  revalidatePath("/teacher/lesson-builder");
  revalidatePath("/teacher/quizzes");
  revalidatePath("/teacher/classes");
  revalidatePath("/dashboard");

  return {
    id: saved.id,
    lessonTitle: saved.lessonTitle,
    pdfUrl: saved.pdfUrl,
    vocabularyDetailPdfUrl: saved.vocabularyDetailPdfUrl,
    deckId: deckTarget.deckId,
    sourceDeckName: deckTarget.sourceDeckName,
  };
}

const updateLessonPlanSchema = saveLessonPlanSchema.extend({
  lessonPlanId: z.number().int().positive(),
});

export async function updateLessonPlanAction(data: {
  lessonPlanId: number;
  input: LessonPlanInput;
  result: LessonPlanResult;
  deckId?: number;
  teamId?: number;
}): Promise<{
  id: number;
  lessonTitle: string;
  pdfUrl: string | null;
  vocabularyDetailPdfUrl: string | null;
  deckId: number;
  sourceDeckName: string;
}> {
  const ctx = await getAccessContext();
  const { userId } = await requireTeacherToolsAccess(
    ctx,
    "Lesson Builder requires an education plan.",
  );

  const parsed = updateLessonPlanSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid lesson plan data");
  }

  const existing = await resolveSavedLessonPlanForViewer(
    userId,
    parsed.data.lessonPlanId,
    parsed.data.teamId,
  );
  if (!existing) {
    throw new Error("Lesson plan not found.");
  }

  const deckTarget = await resolveLessonPlanDeckTarget(userId, parsed.data);

  let pdfUrl: string | null = existing.pdfUrl;
  let pdfFileName: string | null = existing.pdfFileName;
  let vocabularyDetailPdfUrl: string | null = existing.vocabularyDetailPdfUrl;
  let vocabularyDetailPdfFileName: string | null = existing.vocabularyDetailPdfFileName;
  const unitContext: LessonPlanPdfUnitContext = {
    planPeriodDays: clampPlanPeriodDays(
      parsed.data.input.planPeriodDays ?? DEFAULT_PLAN_PERIOD_DAYS,
    ),
    lessonDuration: parsed.data.input.lessonDuration,
  };

  try {
    const pdfBuffer = await generateLessonPlanPdfBuffer(parsed.data.result, unitContext);
    pdfFileName = `${lessonPlanPdfSafeFileName(parsed.data.result.lessonTitle)}.pdf`;
    const uploadedUrl = await uploadLessonPlanPdfBufferToS3({
      userId: existing.userId,
      fileName: pdfFileName,
      buffer: pdfBuffer,
    });
    if (uploadedUrl && existing.pdfUrl && existing.pdfUrl !== uploadedUrl) {
      try {
        await deleteFromS3(existing.pdfUrl);
      } catch {
        // proceed even if old PDF removal fails
      }
    }
    pdfUrl = uploadedUrl;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[updateLessonPlanAction] PDF upload skipped or failed; keeping prior PDF if any.",
        error,
      );
    }
  }

  const vocabularyDetailPdf = await tryUploadLessonPlanVocabularyDetailPdf(
    existing.userId,
    parsed.data.result,
    unitContext,
  );
  if (vocabularyDetailPdf.vocabularyDetailPdfUrl) {
    if (
      existing.vocabularyDetailPdfUrl &&
      existing.vocabularyDetailPdfUrl !== vocabularyDetailPdf.vocabularyDetailPdfUrl
    ) {
      try {
        await deleteFromS3(existing.vocabularyDetailPdfUrl);
      } catch {
        // proceed even if old vocabulary detail PDF removal fails
      }
    }
    vocabularyDetailPdfUrl = vocabularyDetailPdf.vocabularyDetailPdfUrl;
    vocabularyDetailPdfFileName = vocabularyDetailPdf.vocabularyDetailPdfFileName;
  } else if (!lessonPlanHasVocabularyDetails(parsed.data.result)) {
    vocabularyDetailPdfUrl = null;
    vocabularyDetailPdfFileName = null;
  }

  const updated = await updateSavedLessonPlanById(parsed.data.lessonPlanId, {
    input: parsed.data.input,
    result: parsed.data.result,
    pdfUrl,
    pdfFileName,
    vocabularyDetailPdfUrl,
    vocabularyDetailPdfFileName,
    deckId: deckTarget.deckId,
    sourceDeckName: deckTarget.sourceDeckName,
  });

  if (!updated) {
    throw new Error("Could not update lesson plan.");
  }

  revalidatePath("/teacher/resources");
  revalidatePath("/teacher/lesson-builder");
  revalidatePath("/teacher/quizzes");
  revalidatePath("/teacher/classes");
  revalidatePath("/dashboard");

  return {
    id: updated.id,
    lessonTitle: updated.lessonTitle,
    pdfUrl: updated.pdfUrl,
    vocabularyDetailPdfUrl: updated.vocabularyDetailPdfUrl,
    deckId: deckTarget.deckId,
    sourceDeckName: deckTarget.sourceDeckName,
  };
}
