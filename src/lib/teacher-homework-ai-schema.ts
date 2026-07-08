import { z } from "zod";

export const homeworkSourceTypeSchema = z.enum(["topic", "lesson_plan", "deck"]);

export type HomeworkSourceType = z.infer<typeof homeworkSourceTypeSchema>;

export const teacherHomeworkInputSchema = z
  .object({
    sourceType: homeworkSourceTypeSchema,
    savedLessonPlanId: z.number().int().positive().optional(),
    deckId: z.number().int().positive().optional(),
    subject: z.string().min(1),
    gradeLevel: z.string().min(1),
    topic: z.string().min(1),
    numberOfQuestions: z.number().int().min(1).max(30),
    difficultyLevel: z.string().min(1),
    teamId: z.number().int().positive().optional(),
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
  });

export type TeacherHomeworkActionInput = z.infer<typeof teacherHomeworkInputSchema>;

export const homeworkResultSchema = z.object({
  assignmentTitle: z.string().min(1),
  instructions: z.string().min(1),
  questions: z.array(z.string().min(1)).min(1),
  answerKey: z.array(z.string().min(1)).min(1),
});

export type HomeworkResult = z.infer<typeof homeworkResultSchema>;
