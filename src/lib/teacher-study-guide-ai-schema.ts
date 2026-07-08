import { z } from "zod";
import { lessonPlanReferenceMaterialSchema } from "@/lib/lesson-plan-ai-schema";
import { MAX_LESSON_PLAN_REFERENCES } from "@/lib/lesson-plan-reference-material";

export const teacherStudyGuideInputSchema = z.object({
  subject: z.string().min(1),
  gradeLevel: z.string().min(1),
  topic: z.string().min(1),
  savedLessonPlanId: z.number().int().positive().optional(),
  savedHomeworkId: z.number().int().positive().optional(),
  referenceMaterials: z
    .array(lessonPlanReferenceMaterialSchema)
    .max(MAX_LESSON_PLAN_REFERENCES)
    .optional(),
  regenerationSeed: z.number().int().nonnegative().optional(),
  teamId: z.number().int().positive().optional(),
});

export type TeacherStudyGuideActionInput = z.infer<typeof teacherStudyGuideInputSchema>;

export const studyGuideResultSchema = z.object({
  summary: z.string().min(1),
  keyVocabulary: z.array(z.string().min(1)).min(4).max(14),
  importantPoints: z.array(z.string().min(1)).min(4).max(10),
  workedExamples: z.array(z.string().min(1)).min(2).max(5),
  sampleProblems: z.array(z.string().min(1)).min(3).max(6),
  practiceQuestions: z.array(z.string().min(1)).min(4).max(8),
  studyTips: z.array(z.string().min(1)).min(3).max(6),
});

export type StudyGuideAiResult = z.infer<typeof studyGuideResultSchema>;
