"use server";

import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAccessContext } from "@/lib/access";
import { requireTeacherToolsAccess } from "@/lib/teacher-access";
import {
  lessonPlanDayVocabularyDetailSchema,
  lessonPlanInputSchema,
  lessonPlanResultSchema,
  type LessonPlanActionInput,
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
} from "@/lib/lesson-plan-vocabulary-detail";
import { vocabularyApproachPromptLine } from "@/lib/lesson-plan-vocabulary-approach";
import {
  clampPlanPeriodDays,
  DEFAULT_PLAN_PERIOD_DAYS,
  formatUnitPacingLabel,
  reconcileWeeklySchedule,
  weeklySchedulePromptBlock,
} from "@/lib/lesson-plan-weekly-schedule";
import { saveLessonPlan } from "@/db/queries/saved-lesson-plans";
import { createDeck, getDeckRowById } from "@/db/queries/decks";
import { linkDeckToTeamWorkspace, resolveDeckViewerAccess } from "@/db/queries/teams";
import {
  buildTeacherLessonDeckMetadata,
  resolveTeacherQuizSaveTarget,
} from "@/lib/teacher-quiz-deck-save";
import {
  generateLessonPlanPdfBuffer,
  lessonPlanPdfSafeFileName,
} from "@/lib/lesson-plan-pdf-build";
import { uploadLessonPlanPdfBufferToS3 } from "@/lib/s3";
import {
  extractTextFromFile,
  extractTextFromUrl,
  assertFormatAllowedForPlan,
} from "@/lib/document-extract";
import { canUseAdvancedSourceImport } from "@/lib/source-import-access";
import {
  formatLessonPlanReferenceForPrompt,
  formatMultipleLessonPlanReferencesForPrompt,
  referenceSourceSummaryLabel,
} from "@/lib/lesson-plan-reference-material";
import { isYouTubeUrl, youTubeReferenceSummary } from "@/lib/youtube-url";
import {
  generateLessonPlan,
  type LessonPlanInput,
  type LessonPlanResult,
} from "@/lib/teacher-generators";

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

function normalizeLessonPlanResult(
  output: LessonPlanResult,
  input: LessonPlanActionInput,
): LessonPlanResult {
  const planPeriodDays = clampPlanPeriodDays(input.planPeriodDays);
  const filtered = {
    ...output,
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

export async function generateLessonPlanAction(
  data: LessonPlanActionInput,
): Promise<LessonPlanResult> {
  const ctx = await getAccessContext();
  await requireTeacherToolsAccess(
    ctx,
    "Lesson Builder requires an education plan.",
  );

  const parsed = lessonPlanInputSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid input");
  }

  const input = parsed.data;

  const curriculumContext = input.learningStandard?.trim()
    ? await fetchCurriculumContextForLessonPlan(input)
    : null;

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return generateLessonPlan(input);
  }

  try {
    const { output } = await generateText({
      model: openai("gpt-4o"),
      output: Output.object({
        schema: lessonPlanResultSchema,
      }),
      system: `You are an expert K–12 curriculum designer. Create detailed, classroom-ready lesson plans teachers can use immediately.

Requirements:
- Write specific, in-depth content — never generic placeholders like "term A", "key concept 1", or "sample problem".
- Vocabulary must list real subject-specific terms for the topic. Format each entry as "Term — concise student-friendly definition" (6–10 terms).
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

    return normalizeLessonPlanResult(output, input);
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
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return buildTemplateDayVocabularyDetail(input);
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
        schema: lessonPlanDayVocabularyDetailSchema,
      }),
      system: `You are an expert K–12 curriculum writer. Expand a lesson day's vocabulary into classroom-ready teacher reference material.

Requirements:
- Write specific, accurate content for the subject, grade, topic, and learning standard (when provided).
- terms: one entry per assigned vocabulary line for this day. shortDefinition is the concise student-friendly meaning; definition is a fuller classroom explanation (2–4 sentences); example is a concrete italic-ready classroom example starting with "Example:".
- mainConcept: a "Main Concept" section explaining how the day's terms connect to the topic (like a study guide overview).
- process: numbered instructional steps (Collect, Organize, Display, Analyze, Interpret, etc. when appropriate) with bullet sub-points — match the rigor of ${input.difficultyLevel}.
- learningGoal: "By the end of this class period, students should be able to:" plus measurable objectives.
- additionalVocabulary: 6–12 related terms students should know for this topic/day (PEP/exam-aligned when learning standard mentions Jamaica PEP or similar).
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

    return output;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[generateDayVocabularyDetailAction] AI failed; using template fallback.",
        error,
      );
    }
    return buildTemplateDayVocabularyDetail(input);
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
    throw new Error("Invalid input");
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
    throw new Error("Invalid input");
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
    referenceMaterials: true,
    referenceMaterialText: true,
    referenceSourceSummary: true,
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
    return {
      text: extracted.text,
      summary: isYouTubeUrl(url)
        ? youTubeReferenceSummary(url, extracted.sourceTitle)
        : referenceSourceSummaryLabel("url", { url }),
    };
  }

  const file = fileEntry as File;
  const extracted = await extractTextFromFile(file);
  assertFormatAllowedForPlan(extracted.format, advancedImport);
  return {
    text: extracted.text,
    summary: referenceSourceSummaryLabel(extracted.format, { fileName: file.name }),
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

  try {
    const pdfBuffer = await generateLessonPlanPdfBuffer(parsed.data.result, {
      planPeriodDays: clampPlanPeriodDays(
        parsed.data.input.planPeriodDays ?? DEFAULT_PLAN_PERIOD_DAYS,
      ),
      lessonDuration: parsed.data.input.lessonDuration,
    });
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

  const saved = await saveLessonPlan({
    userId,
    input: parsed.data.input,
    result: parsed.data.result,
    pdfUrl,
    pdfFileName,
    deckId: deckTarget.deckId,
    sourceDeckName: deckTarget.sourceDeckName,
  });

  revalidatePath("/teacher/resources");
  revalidatePath("/teacher/quizzes");
  revalidatePath("/teacher/classes");
  revalidatePath("/dashboard");

  return {
    id: saved.id,
    lessonTitle: saved.lessonTitle,
    pdfUrl: saved.pdfUrl,
    deckId: deckTarget.deckId,
    sourceDeckName: deckTarget.sourceDeckName,
  };
}
