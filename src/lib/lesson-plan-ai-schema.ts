import { z } from "zod";
import { SOURCE_IMPORT_MAX_EXTRACTED_CHARS } from "@/lib/source-import-formats";
import { MAX_LESSON_PLAN_REFERENCES } from "@/lib/lesson-plan-reference-material";

export const lessonPlanReferenceMaterialSchema = z.object({
  text: z.string().max(SOURCE_IMPORT_MAX_EXTRACTED_CHARS),
  summary: z.string().max(200),
});

export const lessonPlanDifficultySchema = z.enum([
  "All",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Honors/Gifted",
]);

export const vocabularyTeachingApproachSchema = z.enum([
  "weekly",
  "daily_lessons",
]);

export type VocabularyTeachingApproach = z.infer<
  typeof vocabularyTeachingApproachSchema
>;

export const lessonPlanInputSchema = z.object({
  subject: z.string().min(1),
  gradeLevel: z.string().min(1),
  topic: z.string().min(1),
  lessonDuration: z.string().min(1),
  difficultyLevel: lessonPlanDifficultySchema,
  learningStandard: z.string().optional(),
  classSize: z.string().optional(),
  specialInstructions: z.string().optional(),
  /** Extracted text from optional URL/file references — generation only, not persisted on save. */
  referenceMaterials: z
    .array(lessonPlanReferenceMaterialSchema)
    .max(MAX_LESSON_PLAN_REFERENCES)
    .optional(),
  /** @deprecated Prefer `referenceMaterials`. Combined text for legacy callers. */
  referenceMaterialText: z.string().max(SOURCE_IMPORT_MAX_EXTRACTED_CHARS).optional(),
  /** @deprecated Prefer `referenceMaterials`. Combined summary for legacy callers. */
  referenceSourceSummary: z.string().max(500).optional(),
  regenerationSeed: z.number().int().nonnegative().optional(),
  vocabularyTeachingApproach: vocabularyTeachingApproachSchema.optional(),
});

export type LessonPlanActionInput = z.infer<typeof lessonPlanInputSchema>;

export const lessonPlanResultSchema = z.object({
  lessonTitle: z.string().min(1),
  learningObjectives: z.array(z.string().min(1)).min(3).max(8),
  materialsNeeded: z.array(z.string().min(1)).min(4).max(12),
  vocabulary: z.array(z.string().min(1)).min(6).max(14),
  lessonTimeline: z.array(z.string().min(1)).min(4).max(8),
  warmUpActivity: z.string().min(1),
  mainTeachingSteps: z.array(z.string().min(1)).min(5).max(10),
  classroomActivity: z.string().min(1),
  assessmentQuestions: z.array(z.string().min(1)).min(4).max(8),
  homework: z.string().min(1),
  differentiatedInstruction: z.array(z.string().min(1)).min(1).max(6),
  teacherNotes: z.string().min(1),
});
