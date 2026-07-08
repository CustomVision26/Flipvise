import { z } from "zod";
import { lessonPlanDifficultySchema } from "@/lib/lesson-plan-ai-schema";
import { PRO_PLUS_CARDS_PER_DECK_LIMIT } from "@/lib/personal-plan-limits";

export const saveTeacherQuizDeckSchema = z.object({
  savedLessonPlanId: z.number().int().positive().optional(),
  subject: z.string().min(1),
  gradeLevel: z.string().min(1),
  topic: z.string().min(1),
  difficultyLevel: z.string().min(1),
  teamId: z.number().int().positive().optional(),
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
    readingPassageQuestionCount: z
      .number()
      .int()
      .min(0)
      .max(PRO_PLUS_CARDS_PER_DECK_LIMIT)
      .optional(),
    teamId: z.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => {
    const passageCount = data.readingPassageQuestions
      ? (data.readingPassageQuestionCount ?? 0)
      : 0;
    const standardCount = data.numberOfQuestions;
    const total = standardCount + passageCount;

    if (total < 1) {
      ctx.addIssue({
        code: "custom",
        message: "Enter at least one regular or passage card to generate.",
        path: ["numberOfQuestions"],
      });
    }

    if (total > PRO_PLUS_CARDS_PER_DECK_LIMIT) {
      ctx.addIssue({
        code: "custom",
        message: `Combined card count cannot exceed ${PRO_PLUS_CARDS_PER_DECK_LIMIT} per deck.`,
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

export const teacherQuizPassageQuestionSchema = z.object({
  passage: z.string().min(1),
  question: z.string().min(1),
  correctAnswer: z.string().min(1),
  wrongAnswers: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
  explanation: z.string().min(1),
});

export type TeacherQuizPassageQuestion = z.infer<typeof teacherQuizPassageQuestionSchema>;

export const teacherQuizPassageResultSchema = z.object({
  questions: z
    .array(teacherQuizPassageQuestionSchema)
    .min(1)
    .max(PRO_PLUS_CARDS_PER_DECK_LIMIT),
  answerKey: z
    .array(z.string().min(1))
    .max(PRO_PLUS_CARDS_PER_DECK_LIMIT)
    .optional(),
});

export type TeacherQuizPassageResult = z.infer<typeof teacherQuizPassageResultSchema>;

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
