import { z } from "zod";
import { lessonPlanDifficultySchema } from "@/lib/lesson-plan-ai-schema";
import { lessonPlanDayScopeSchema } from "@/lib/lesson-plan-day-scope";
import { PRO_PLUS_CARDS_PER_DECK_LIMIT } from "@/lib/personal-plan-limits";
import { stripLatexArtifacts } from "@/lib/source-import-reading-passage";
import {
  DEFAULT_PASSAGE_GENERATION_TOGGLES,
  DEFAULT_TEACHER_QUIZ_PASSAGE_QUESTION_TYPES,
  DEFAULT_TEACHER_QUIZ_PASSAGE_STYLE,
  DEFAULT_TEACHER_QUIZ_PASSAGE_TYPE,
  DEFAULT_TEACHER_QUIZ_READING_LEVEL,
  TEACHER_QUIZ_MAX_QUESTIONS_PER_PASSAGE,
  passageGenerationTogglesSchema,
  teacherQuizPassageQuestionTypeSchema,
  teacherQuizPassageStyleSchema,
  teacherQuizPassageTypeSchema,
  teacherQuizReadingLevelSchema,
} from "@/lib/teacher-quiz-passage-settings";

export const saveTeacherQuizDeckSchema = z.object({
  savedLessonPlanId: z.number().int().positive().optional(),
  subject: z.string().min(1),
  gradeLevel: z.string().min(1),
  topic: z.string().min(1),
  difficultyLevel: z.string().min(1),
  teamId: z.number().int().positive().optional(),
  /** Day scope used when the quiz was generated from a multi-day lesson plan. */
  dayScope: lessonPlanDayScopeSchema.optional(),
  cards: z
    .array(
      z.object({
        front: z.string().min(1),
        back: z.string().min(1),
        distractors: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
      }),
    )
    .min(1)
    .max(PRO_PLUS_CARDS_PER_DECK_LIMIT),
});

export const previewTeacherQuizDistractorsSchema = z.object({
  subject: z.string().min(1),
  gradeLevel: z.string().min(1),
  topic: z.string().min(1),
  difficultyLevel: z.string().min(1),
  distractorQuestion: z.string().min(1),
  distractorAnswer: z.string().min(1),
});

export type SaveTeacherQuizDeckInput = z.infer<typeof saveTeacherQuizDeckSchema>;
export type PreviewTeacherQuizDistractorsInput = z.infer<
  typeof previewTeacherQuizDistractorsSchema
>;

export const TEACHER_QUIZ_DEFAULT_QUESTION_COUNT = 10;
export const TEACHER_QUIZ_DEFAULT_QUESTION_TYPE = "Multiple choice";
/** Max configurable passage rows in the quiz form (including 0-question skip rows). */
export const TEACHER_QUIZ_MAX_PASSAGES = 10;

/** Sum of per-passage question counts (0s included in the sum as zero). */
export function sumPassageQuestionCounts(counts: number[]): number {
  return counts.reduce((sum, count) => sum + Math.max(0, count), 0);
}

/** Counts used for AI generation — omit passages the user set to 0 questions. */
export function activePassageQuestionCounts(counts: number[]): number[] {
  return counts.filter((count) => count >= 1);
}

export const teacherQuizInputSchema = z
  .object({
    savedLessonPlanId: z.number().int().positive().optional(),
    subject: z.string().min(1),
    gradeLevel: z.string().min(1),
    topic: z.string().min(1),
    numberOfQuestions: z
      .number()
      .int()
      .min(0)
      .max(PRO_PLUS_CARDS_PER_DECK_LIMIT),
    questionTypes: z.string().min(1),
    difficultyLevel: z.union([lessonPlanDifficultySchema, z.string().min(1)]),
    regenerationSeed: z.number().int().nonnegative().optional(),
    readingPassageQuestions: z.boolean().optional(),
    /** Number of passage rows configured in the UI (may include 0-question skips). */
    readingPassageCount: z
      .number()
      .int()
      .min(1)
      .max(TEACHER_QUIZ_MAX_PASSAGES)
      .optional(),
    /** Per-passage question counts; length must match `readingPassageCount` when enabled. */
    readingPassageQuestionCounts: z
      .array(z.number().int().min(0).max(PRO_PLUS_CARDS_PER_DECK_LIMIT))
      .min(1)
      .max(TEACHER_QUIZ_MAX_PASSAGES)
      .optional(),
    /** Uniform questions-per-passage when the simplified UI is used. */
    questionsPerPassage: z
      .number()
      .int()
      .min(1)
      .max(TEACHER_QUIZ_MAX_QUESTIONS_PER_PASSAGE)
      .optional(),
    passageType: teacherQuizPassageTypeSchema.optional(),
    passageStyle: teacherQuizPassageStyleSchema.optional(),
    readingLevel: teacherQuizReadingLevelSchema.optional(),
    passageQuestionTypes: z
      .array(teacherQuizPassageQuestionTypeSchema)
      .min(1)
      .max(4)
      .optional(),
    includeVocabulary: z.boolean().optional(),
    includeTeacherNotes: z.boolean().optional(),
    includeAnswerExplanations: z.boolean().optional(),
    useRelevantLocalContext: z.boolean().optional(),
    avoidPreviousPassages: z.boolean().optional(),
    previousPassageSummaries: z
      .array(
        z.object({
          title: z.string().optional(),
          scenarioCategory: z.string().optional(),
          scenarioSummary: z.string().optional(),
        }),
      )
      .max(12)
      .optional(),
    teamId: z.number().int().positive().optional(),
    /** When set with a multi-day plan, scopes AI context to All Days or one day. */
    dayScope: lessonPlanDayScopeSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const configuredPassages = data.readingPassageCount ?? 0;
    const fromCounts = data.readingPassageQuestionCounts;
    const uniform = data.questionsPerPassage;
    const passageCounts = data.readingPassageQuestions
      ? fromCounts && fromCounts.length > 0
        ? fromCounts
        : uniform != null && configuredPassages > 0
          ? Array.from({ length: configuredPassages }, () => uniform)
          : []
      : [];
    const passageCount = sumPassageQuestionCounts(passageCounts);
    const standardCount = data.numberOfQuestions;
    const total = standardCount + passageCount;

    if (data.readingPassageQuestions) {
      if (configuredPassages < 1) {
        ctx.addIssue({
          code: "custom",
          message: "Enter how many reading passages to include.",
          path: ["readingPassageCount"],
        });
      }
      if (passageCounts.length !== configuredPassages) {
        ctx.addIssue({
          code: "custom",
          message: "Set questions per passage for reading passages.",
          path: ["readingPassageQuestionCounts"],
        });
      }
      if (activePassageQuestionCounts(passageCounts).length < 1) {
        ctx.addIssue({
          code: "custom",
          message:
            "Give at least one passage one or more questions, or turn off Include reading passage.",
          path: ["questionsPerPassage"],
        });
      }
      const qTypes = data.passageQuestionTypes ?? DEFAULT_TEACHER_QUIZ_PASSAGE_QUESTION_TYPES;
      if (qTypes.length < 1) {
        ctx.addIssue({
          code: "custom",
          message: "Select at least one passage question type.",
          path: ["passageQuestionTypes"],
        });
      }
    }

    if (total < 1) {
      ctx.addIssue({
        code: "custom",
        message:
          "Enter at least one regular quiz card or one question linked to a reading passage.",
        path: ["numberOfQuestions"],
      });
    }

    if (total > PRO_PLUS_CARDS_PER_DECK_LIMIT) {
      ctx.addIssue({
        code: "custom",
        message: `Combined card count (regular + passage questions) cannot exceed ${PRO_PLUS_CARDS_PER_DECK_LIMIT} per deck.`,
        path: ["numberOfQuestions"],
      });
    }

    if (!data.readingPassageQuestions && standardCount < 1) {
      ctx.addIssue({
        code: "custom",
        message: "Enter at least one card to generate.",
        path: ["numberOfQuestions"],
      });
    }
  });

export type TeacherQuizActionInput = z.infer<typeof teacherQuizInputSchema>;

export const teacherQuizQuestionSchema = z.object({
  question: z.string().min(1),
  choices: z.array(z.string().min(1)).length(4),
  correctAnswer: z.string().min(1),
  explanation: z.string().min(1),
});

/**
 * One comprehension item tied to a reading passage (AI structured-output item).
 * OpenAI structured outputs require every property to be required — use
 * `.nullable()` (not `.optional()`) for fields the model may leave empty.
 */
export const teacherQuizPassageItemSchema = z.object({
  questionType: z.string().min(1),
  question: z.string().min(1),
  correctAnswer: z.string().min(1),
  // Use .array().length(3) — OpenAI structured output rejects Zod tuples.
  // Flipvise quiz cards require three distractors for all question types.
  wrongAnswers: z.array(z.string().min(1)).length(3),
  explanation: z.string(),
  competencyAssessed: z.string().nullable(),
});

export type TeacherQuizPassageItem = z.infer<typeof teacherQuizPassageItemSchema>;

/**
 * Card-level passage quiz shape after expansion: passage text on each card front
 * with its comprehension question (passages may differ across cards).
 */
export const teacherQuizPassageQuestionSchema = z.object({
  passage: z.string().min(1),
  /** Short title shown above the passage body. */
  passageTitle: z.string().min(1).optional(),
  educationalContext: z.string().min(1).optional(),
  scenarioCategory: z.string().min(1).optional(),
  scenarioSummary: z.string().min(1).optional(),
  vocabularyUsed: z.array(z.string().min(1)).optional(),
  learningObjectivesCovered: z.array(z.string().min(1)).optional(),
  alignedStandards: z.array(z.string().min(1)).optional(),
  alignedCompetencies: z.array(z.string().min(1)).optional(),
  passageGroupId: z.string().min(1).optional(),
  sourceLessonPlanId: z.number().int().positive().optional(),
  question: z.string().min(1),
  correctAnswer: z.string().min(1),
  wrongAnswers: z.array(z.string().min(1)).length(3),
  explanation: z.string().min(1),
  questionType: z.string().min(1).optional(),
});

export type TeacherQuizPassageQuestion = z.infer<typeof teacherQuizPassageQuestionSchema>;

/**
 * One AI passage block for structured output.
 * Optional fields are `.nullable()` — OpenAI rejects `.optional()` properties.
 */
export const teacherQuizPassageBlockSchema = z.object({
  title: z.string().min(1),
  passageType: z.string().min(1),
  /** Unique category label for diversity checks — must describe an event/context, not a vocab term. */
  scenarioCategory: z.string().min(1),
  /** One-sentence unique central event (required). */
  scenarioSummary: z.string().min(1),
  centralEvent: z.string().min(1),
  mainProblem: z.string().min(1),
  consequence: z.string().min(1),
  requiredResponse: z.string().min(1),
  perspective: z.string().min(1),
  setting: z.string().min(1),
  /** Legacy alias kept for model/backward compatibility. */
  educationalContext: z.string().nullable(),
  passage: z.string().min(1),
  alignedStandards: z.array(z.string().min(1)).max(12),
  alignedObjectives: z.array(z.string().min(1)).max(12),
  alignedCompetencies: z.array(z.string().min(1)).max(12),
  vocabularyTermsUsed: z.array(z.string().min(1)).max(20),
  vocabularyUsed: z.array(z.string().min(1)).max(20),
  learningObjectivesCovered: z.array(z.string().min(1)).max(12),
  teacherNotes: z.string().nullable(),
  questions: z
    .array(teacherQuizPassageItemSchema)
    .min(1)
    .max(PRO_PLUS_CARDS_PER_DECK_LIMIT),
});

export type TeacherQuizPassageBlock = z.infer<typeof teacherQuizPassageBlockSchema>;

/** Sequential generation: exactly one passage per AI call. */
export const teacherQuizSinglePassageResultSchema = z.object({
  passage: teacherQuizPassageBlockSchema,
});

export type TeacherQuizSinglePassageResult = z.infer<
  typeof teacherQuizSinglePassageResultSchema
>;

/**
 * Collected passages after sequential generation (app-side aggregation).
 * Not sent to OpenAI Output.object — answerKey stays optional here.
 */
export const teacherQuizMultiPassageResultSchema = z.object({
  passages: z
    .array(teacherQuizPassageBlockSchema)
    .min(1)
    .max(TEACHER_QUIZ_MAX_PASSAGES),
  answerKey: z
    .array(z.string().min(1))
    .max(PRO_PLUS_CARDS_PER_DECK_LIMIT)
    .nullable()
    .optional(),
});

export type TeacherQuizMultiPassageResult = z.infer<
  typeof teacherQuizMultiPassageResultSchema
>;

function buildPassageCardExplanation(
  item: TeacherQuizPassageItem,
  block: TeacherQuizPassageBlock,
  includeAnswerExplanations: boolean,
): string {
  const parts: string[] = [];
  const explanation = item.explanation?.trim();
  if (includeAnswerExplanations && explanation) {
    parts.push(explanation);
  } else if (!includeAnswerExplanations) {
    parts.push("See correct answer.");
  } else {
    parts.push("Answer grounded in the passage.");
  }

  const category =
    block.scenarioCategory?.trim() || block.educationalContext?.trim();
  if (category) parts.push(`Scenario category: ${category}`);
  const summary = block.scenarioSummary?.trim();
  if (summary) parts.push(`Scenario summary: ${summary}`);
  if (block.centralEvent?.trim()) {
    parts.push(`Central event: ${block.centralEvent.trim()}`);
  }
  if (block.mainProblem?.trim()) {
    parts.push(`Main problem: ${block.mainProblem.trim()}`);
  }
  if (block.setting?.trim()) {
    parts.push(`Setting: ${block.setting.trim()}`);
  }
  const objectives = uniqueNonEmpty([
    ...(block.alignedObjectives ?? []),
    ...(block.learningObjectivesCovered ?? []),
  ]);
  if (objectives.length > 0) {
    parts.push(`Learning objectives covered: ${objectives.join("; ")}`);
  }
  const competencies = uniqueNonEmpty(block.alignedCompetencies ?? []);
  if (competencies.length > 0) {
    parts.push(`Competencies: ${competencies.join("; ")}`);
  }
  const vocab = uniqueNonEmpty([
    ...(block.vocabularyTermsUsed ?? []),
    ...(block.vocabularyUsed ?? []),
  ]);
  if (vocab.length > 0) {
    parts.push(`Vocabulary used: ${vocab.join("; ")}`);
  }
  if (block.teacherNotes?.trim()) {
    parts.push(`Teacher notes: ${block.teacherNotes.trim()}`);
  }
  return parts.join("\n\n");
}

function uniqueNonEmpty(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export type ExpandMultiPassageOptions = {
  expectedQuestionCounts?: number[];
  includeAnswerExplanations?: boolean;
  includeTeacherNotes?: boolean;
  sourceLessonPlanId?: number;
};

/**
 * Expands multi-passage AI output into saveable quiz cards.
 * Each question becomes one card with its owning passage on the front.
 */
export function expandMultiPassageToQuizCards(
  result: TeacherQuizMultiPassageResult,
  expectedQuestionCountsOrOptions?: number[] | ExpandMultiPassageOptions,
): TeacherQuizPassageQuestion[] {
  const options: ExpandMultiPassageOptions = Array.isArray(expectedQuestionCountsOrOptions)
    ? { expectedQuestionCounts: expectedQuestionCountsOrOptions }
    : (expectedQuestionCountsOrOptions ?? {});
  const expectedQuestionCounts = options.expectedQuestionCounts;
  const includeAnswerExplanations = options.includeAnswerExplanations !== false;
  const includeTeacherNotes = options.includeTeacherNotes === true;

  const blocks =
    expectedQuestionCounts && expectedQuestionCounts.length > 0
      ? result.passages.slice(0, expectedQuestionCounts.length)
      : result.passages;

  return blocks.flatMap((block, index) => {
    const passage = stripLatexArtifacts(block.passage.trim());
    const passageTitle = block.title?.trim()
      ? stripLatexArtifacts(block.title.trim())
      : undefined;
    const scenarioCategory =
      block.scenarioCategory?.trim() || block.educationalContext?.trim() || undefined;
    const scenarioSummary = block.scenarioSummary?.trim() || undefined;
    const educationalContext = scenarioCategory;
    const vocabularyUsed = uniqueNonEmpty([
      ...(block.vocabularyTermsUsed ?? []),
      ...(block.vocabularyUsed ?? []),
    ]);
    const learningObjectivesCovered = uniqueNonEmpty([
      ...(block.alignedObjectives ?? []),
      ...(block.learningObjectivesCovered ?? []),
    ]);
    const alignedStandards = uniqueNonEmpty(block.alignedStandards ?? []);
    const alignedCompetencies = uniqueNonEmpty(block.alignedCompetencies ?? []);
    const passageGroupId = `passage-${index + 1}-${slugFragment(passageTitle ?? scenarioCategory ?? "block")}`;
    const limit = expectedQuestionCounts?.[index];
    const questions =
      limit != null ? block.questions.slice(0, limit) : block.questions;
    const blockForExplanation = includeTeacherNotes
      ? block
      : { ...block, teacherNotes: null };

    return questions.map((item) => ({
      passage,
      passageTitle,
      educationalContext,
      scenarioCategory,
      scenarioSummary,
      vocabularyUsed,
      learningObjectivesCovered,
      alignedStandards,
      alignedCompetencies,
      passageGroupId,
      sourceLessonPlanId: options.sourceLessonPlanId,
      question: stripLatexArtifacts(item.question.trim()),
      correctAnswer: stripLatexArtifacts(item.correctAnswer.trim()),
      wrongAnswers: item.wrongAnswers.map((answer) =>
        stripLatexArtifacts(answer.trim()),
      ) as [string, string, string],
      explanation: stripLatexArtifacts(
        buildPassageCardExplanation(
          item,
          blockForExplanation,
          includeAnswerExplanations,
        ),
      ),
      questionType: item.questionType?.trim() || undefined,
    }));
  });
}

export function blockToDiversityInput(
  block: TeacherQuizPassageBlock,
): import("@/lib/passage-diversity").PassageDiversityInput {
  return {
    title: block.title,
    scenarioCategory: block.scenarioCategory ?? block.educationalContext,
    scenarioSummary: block.scenarioSummary,
    centralEvent: block.centralEvent,
    mainProblem: block.mainProblem,
    consequence: block.consequence,
    requiredResponse: block.requiredResponse,
    perspective: block.perspective,
    setting: block.setting,
    passageText: block.passage,
    vocabularyTermsUsed: uniqueNonEmpty([
      ...(block.vocabularyTermsUsed ?? []),
      ...(block.vocabularyUsed ?? []),
    ]),
    alignedObjectives: uniqueNonEmpty([
      ...(block.alignedObjectives ?? []),
      ...(block.learningObjectivesCovered ?? []),
    ]),
  };
}

function slugFragment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "block";
}

/** Resolve passage generation toggles with defaults. */
export function resolvePassageGenerationToggles(
  input: Pick<
    TeacherQuizActionInput,
    | "includeVocabulary"
    | "includeTeacherNotes"
    | "includeAnswerExplanations"
    | "useRelevantLocalContext"
    | "avoidPreviousPassages"
  >,
) {
  const parsed = passageGenerationTogglesSchema.safeParse({
    includeVocabulary: input.includeVocabulary,
    includeTeacherNotes: input.includeTeacherNotes,
    includeAnswerExplanations: input.includeAnswerExplanations,
    useRelevantLocalContext: input.useRelevantLocalContext,
    avoidPreviousPassages: input.avoidPreviousPassages,
  });
  const data = parsed.success ? parsed.data : {};
  return {
    includeVocabulary:
      data.includeVocabulary ?? DEFAULT_PASSAGE_GENERATION_TOGGLES.includeVocabulary,
    includeTeacherNotes:
      data.includeTeacherNotes ?? DEFAULT_PASSAGE_GENERATION_TOGGLES.includeTeacherNotes,
    includeAnswerExplanations:
      data.includeAnswerExplanations ??
      DEFAULT_PASSAGE_GENERATION_TOGGLES.includeAnswerExplanations,
    useRelevantLocalContext:
      data.useRelevantLocalContext ??
      DEFAULT_PASSAGE_GENERATION_TOGGLES.useRelevantLocalContext,
    avoidPreviousPassages:
      data.avoidPreviousPassages ??
      DEFAULT_PASSAGE_GENERATION_TOGGLES.avoidPreviousPassages,
  };
}

/** Resolve passage counts from new uniform field or legacy per-passage arrays. */
export function resolveReadingPassageQuestionCounts(
  input: Pick<
    TeacherQuizActionInput,
    | "readingPassageQuestions"
    | "readingPassageCount"
    | "readingPassageQuestionCounts"
    | "questionsPerPassage"
  >,
): number[] {
  if (!input.readingPassageQuestions) return [];
  const configured = input.readingPassageCount ?? 0;
  if (
    input.readingPassageQuestionCounts &&
    input.readingPassageQuestionCounts.length > 0
  ) {
    return input.readingPassageQuestionCounts;
  }
  if (input.questionsPerPassage != null && configured > 0) {
    return Array.from({ length: configured }, () => input.questionsPerPassage!);
  }
  return [];
}

export {
  DEFAULT_TEACHER_QUIZ_PASSAGE_QUESTION_TYPES,
  DEFAULT_TEACHER_QUIZ_PASSAGE_STYLE,
  DEFAULT_TEACHER_QUIZ_PASSAGE_TYPE,
  DEFAULT_TEACHER_QUIZ_READING_LEVEL,
};

export const teacherQuizResultSchema = z.object({
  questions: z
    .array(teacherQuizQuestionSchema)
    .min(1)
    .max(PRO_PLUS_CARDS_PER_DECK_LIMIT),
  answerKey: z
    .array(z.string().min(1))
    .min(1)
    .max(PRO_PLUS_CARDS_PER_DECK_LIMIT),
});
