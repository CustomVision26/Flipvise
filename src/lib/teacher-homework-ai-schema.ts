import { z } from "zod";
import { lessonPlanDayScopeSchema } from "@/lib/lesson-plan-day-scope";
import { homeworkAnswerGraphSchema } from "@/lib/homework-answer-graph";

export const homeworkSourceTypeSchema = z.enum(["topic", "lesson_plan", "deck"]);

export type HomeworkSourceType = z.infer<typeof homeworkSourceTypeSchema>;

export const HOMEWORK_MAX_QUESTIONS = 30;
export const HOMEWORK_MAX_PASSAGES = 5;
export const HOMEWORK_MAX_QUESTIONS_PER_PASSAGE = 15;

export { homeworkAnswerGraphSchema };
export type { HomeworkAnswerGraph } from "@/lib/homework-answer-graph";

export const teacherHomeworkInputSchema = z
  .object({
    sourceType: homeworkSourceTypeSchema,
    savedLessonPlanId: z.number().int().positive().optional(),
    deckId: z.number().int().positive().optional(),
    subject: z.string().min(1),
    gradeLevel: z.string().min(1),
    topic: z.string().min(1),
    numberOfQuestions: z.number().int().min(1).max(HOMEWORK_MAX_QUESTIONS),
    /** When set with questionsPerPassage, AI generates this many distinct reading passages. */
    numberOfPassages: z
      .number()
      .int()
      .min(1)
      .max(HOMEWORK_MAX_PASSAGES)
      .optional(),
    /** Questions linked to each passage (total = numberOfPassages × questionsPerPassage). */
    questionsPerPassage: z
      .number()
      .int()
      .min(1)
      .max(HOMEWORK_MAX_QUESTIONS_PER_PASSAGE)
      .optional(),
    difficultyLevel: z.string().min(1),
    teamId: z.number().int().positive().optional(),
    dayScope: lessonPlanDayScopeSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.sourceType === "lesson_plan" && data.savedLessonPlanId == null) {
      ctx.addIssue({
        code: "custom",
        message: "Select a saved lesson plan.",
        path: ["savedLessonPlanId"],
      });
    }
    if (data.sourceType === "deck" && data.deckId == null) {
      ctx.addIssue({
        code: "custom",
        message: "Select a deck.",
        path: ["deckId"],
      });
    }
    const passages = data.numberOfPassages;
    const perPassage = data.questionsPerPassage;
    if (passages != null || perPassage != null) {
      if (passages == null || perPassage == null) {
        ctx.addIssue({
          code: "custom",
          message: "Set both number of passages and questions per passage.",
          path: ["numberOfPassages"],
        });
        return;
      }
      const total = passages * perPassage;
      if (total > HOMEWORK_MAX_QUESTIONS) {
        ctx.addIssue({
          code: "custom",
          message: `Passages × questions per passage cannot exceed ${HOMEWORK_MAX_QUESTIONS}.`,
          path: ["questionsPerPassage"],
        });
      }
      if (data.numberOfQuestions !== total) {
        ctx.addIssue({
          code: "custom",
          message: "Number of questions must equal passages × questions per passage.",
          path: ["numberOfQuestions"],
        });
      }
    }
  });

export type TeacherHomeworkActionInput = z.infer<typeof teacherHomeworkInputSchema>;

/** One student-facing reading passage (questions are stored flat with counts). */
export const homeworkPassageSchema = z.object({
  /** Story/passage title — use null when untitled. Must be present for OpenAI structured output. */
  title: z.string().nullable(),
  body: z.string().min(1),
});

export type HomeworkPassage = z.infer<typeof homeworkPassageSchema>;

/**
 * AI structured-output schema. Optional fields are `.nullable()` (not `.optional()`)
 * so OpenAI's JSON Schema includes every property in `required`.
 */
export const homeworkResultSchema = z.object({
  assignmentTitle: z.string().min(1),
  instructions: z.string().min(1),
  /**
   * Distinct reading passages students read before answering.
   * Null when the assignment has no shared reading text (e.g. pure math practice).
   */
  passages: z
    .array(homeworkPassageSchema)
    .min(1)
    .max(HOMEWORK_MAX_PASSAGES)
    .nullable(),
  /** Parallel to `passages` — questions allocated to each passage in order. Null when no passages. */
  passageQuestionCounts: z
    .array(z.number().int().min(1).max(HOMEWORK_MAX_QUESTIONS_PER_PASSAGE))
    .min(1)
    .max(HOMEWORK_MAX_PASSAGES)
    .nullable(),
  /** Legacy single-passage title — mirror first passage title, or null. */
  passageTitle: z.string().nullable(),
  /** Legacy single-passage body — mirror first passage body, or null. */
  passage: z.string().nullable(),
  questions: z.array(z.string().min(1)).min(1),
  answerKey: z.array(z.string().min(1)).min(1),
  /**
   * Parallel to answerKey — number-line / coordinate figures for graph answers.
   * Use type "none" for text-only answers. Null when no graphs in the set.
   */
  answerGraphs: z.array(homeworkAnswerGraphSchema).nullable(),
});

export type HomeworkResult = z.infer<typeof homeworkResultSchema>;

/** True when subject/topic calls for a shared student reading passage. */
export function homeworkNeedsReadingPassage(
  subject: string,
  topic: string,
): boolean {
  const text = `${subject} ${topic}`.toLowerCase();
  return /reading|comprehension|literature|language arts|\bela\b|english|writing|grammar|vocabulary|pep|narrative|poetry|inference|figurative|main idea|theme|character/.test(
    text,
  );
}

export function resolveHomeworkPassageTotal(input: {
  numberOfPassages?: number;
  questionsPerPassage?: number;
  numberOfQuestions: number;
}): number {
  if (input.numberOfPassages != null && input.questionsPerPassage != null) {
    return input.numberOfPassages * input.questionsPerPassage;
  }
  return input.numberOfQuestions;
}
