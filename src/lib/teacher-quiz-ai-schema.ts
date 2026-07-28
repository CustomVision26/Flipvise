import { z } from "zod";
import { lessonPlanDifficultySchema } from "@/lib/lesson-plan-ai-schema";
import { lessonPlanDayScopeSchema } from "@/lib/lesson-plan-day-scope";
import { PRO_PLUS_CARDS_PER_DECK_LIMIT } from "@/lib/personal-plan-limits";

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
    teamId: z.number().int().positive().optional(),
    /** When set with a multi-day plan, scopes AI context to All Days or one day. */
    dayScope: lessonPlanDayScopeSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const passageCounts = data.readingPassageQuestions
      ? (data.readingPassageQuestionCounts ?? [])
      : [];
    const passageCount = sumPassageQuestionCounts(passageCounts);
    const standardCount = data.numberOfQuestions;
    const total = standardCount + passageCount;

    if (data.readingPassageQuestions) {
      const configuredPassages = data.readingPassageCount ?? 0;
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
          message: "Set a question count for each reading passage.",
          path: ["readingPassageQuestionCounts"],
        });
      }
      if (activePassageQuestionCounts(passageCounts).length < 1) {
        ctx.addIssue({
          code: "custom",
          message:
            "Give at least one passage one or more questions, or turn off Include reading passage.",
          path: ["readingPassageQuestionCounts"],
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

/** One comprehension item tied to a reading passage (AI output item). */
export const teacherQuizPassageItemSchema = z.object({
  questionType: z.string().min(1).optional(),
  question: z.string().min(1),
  correctAnswer: z.string().min(1),
  // Use .array().length(3) — OpenAI structured output rejects Zod tuples.
  wrongAnswers: z.array(z.string().min(1)).length(3),
  explanation: z.string().min(1),
});

export type TeacherQuizPassageItem = z.infer<typeof teacherQuizPassageItemSchema>;

/**
 * Card-level passage quiz shape after expansion: passage text on each card front
 * with its comprehension question (passages may differ across cards).
 */
export const teacherQuizPassageQuestionSchema = z.object({
  passage: z.string().min(1),
  /** Short story title shown above the passage body (e.g. "Selling Fruit Juice"). */
  passageTitle: z.string().min(1).optional(),
  question: z.string().min(1),
  correctAnswer: z.string().min(1),
  wrongAnswers: z.array(z.string().min(1)).length(3),
  explanation: z.string().min(1),
  questionType: z.string().min(1).optional(),
});

export type TeacherQuizPassageQuestion = z.infer<typeof teacherQuizPassageQuestionSchema>;

/** One AI passage block: a distinct reading passage + its linked questions. */
export const teacherQuizPassageBlockSchema = z.object({
  /** Optional story title for the passage (required style for Mathematics). */
  title: z.string().min(1).optional(),
  passage: z.string().min(1),
  questions: z
    .array(teacherQuizPassageItemSchema)
    .min(1)
    .max(PRO_PLUS_CARDS_PER_DECK_LIMIT),
});

export type TeacherQuizPassageBlock = z.infer<typeof teacherQuizPassageBlockSchema>;

/** AI output: one or more distinct informational passages, each with its own questions. */
export const teacherQuizMultiPassageResultSchema = z.object({
  passages: z
    .array(teacherQuizPassageBlockSchema)
    .min(1)
    .max(TEACHER_QUIZ_MAX_PASSAGES),
  answerKey: z
    .array(z.string().min(1))
    .max(PRO_PLUS_CARDS_PER_DECK_LIMIT)
    .optional(),
});

export type TeacherQuizMultiPassageResult = z.infer<
  typeof teacherQuizMultiPassageResultSchema
>;

/**
 * Expands multi-passage AI output into saveable quiz cards.
 * Each question becomes one card with its owning passage on the front.
 */
export function expandMultiPassageToQuizCards(
  result: TeacherQuizMultiPassageResult,
  expectedQuestionCounts?: number[],
): TeacherQuizPassageQuestion[] {
  const blocks =
    expectedQuestionCounts && expectedQuestionCounts.length > 0
      ? result.passages.slice(0, expectedQuestionCounts.length)
      : result.passages;

  return blocks.flatMap((block, index) => {
    const passage = block.passage.trim();
    const passageTitle = block.title?.trim() || undefined;
    const limit = expectedQuestionCounts?.[index];
    const questions =
      limit != null ? block.questions.slice(0, limit) : block.questions;
    return questions.map((item) => ({
      passage,
      passageTitle,
      question: item.question.trim(),
      correctAnswer: item.correctAnswer.trim(),
      wrongAnswers: item.wrongAnswers.map((answer) => answer.trim()) as [
        string,
        string,
        string,
      ],
      explanation: item.explanation.trim(),
      questionType: item.questionType?.trim() || undefined,
    }));
  });
}

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
