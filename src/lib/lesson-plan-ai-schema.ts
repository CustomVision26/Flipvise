import { z } from "zod";
import { SOURCE_IMPORT_MAX_EXTRACTED_CHARS } from "@/lib/source-import-formats";
import { MAX_LESSON_PLAN_REFERENCES } from "@/lib/lesson-plan-reference-material";
import { TEACHER_CLASS_DAY_OPTIONS } from "@/lib/teacher-class-form";

export const PLAN_PERIOD_DAY_OPTIONS = [1, 3, 5, 7] as const;
export type PlanPeriodDays = (typeof PLAN_PERIOD_DAY_OPTIONS)[number];
export const DEFAULT_PLAN_PERIOD_DAYS: PlanPeriodDays = 5;

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

export const lessonPlanVocabularyTermDetailSchema = z.object({
  term: z.string().min(1),
  shortDefinition: z.string().min(1),
  definition: z.string().min(1),
  example: z.string().optional(),
});

export type LessonPlanVocabularyTermDetail = z.infer<
  typeof lessonPlanVocabularyTermDetailSchema
>;

export const lessonPlanProcessStepSchema = z.object({
  // Prefer plain number for OpenAI structured output (avoid z.coerce).
  stepNumber: z.number().int().min(1).max(12),
  title: z.string().min(1),
  bullets: z.array(z.string().min(1)).min(1).max(8),
});

export const FIVE_E_PHASES = [
  "Engage",
  "Explore",
  "Explain",
  "Elaborate",
  "Evaluate",
] as const;

export type FiveEPhaseName = (typeof FIVE_E_PHASES)[number];

export const lessonPlanFiveEPhaseSchema = z.object({
  phase: z.enum(FIVE_E_PHASES),
  timeRange: z.string().min(1),
  activitySummary: z.string().min(1),
  detail: z.string().min(1),
  vocabularyFocus: z.array(z.string().min(1)).max(8),
  teacherMoves: z.array(z.string().min(1)).min(1).max(6),
  studentMoves: z.array(z.string().min(1)).min(1).max(6),
});

export type LessonPlanFiveEPhase = z.infer<typeof lessonPlanFiveEPhaseSchema>;

export const lessonPlanFiveEBreakdownSchema = z.object({
  heading: z.string().min(1),
  intro: z.string().optional(),
  phases: z.array(lessonPlanFiveEPhaseSchema).min(5).max(5),
});

export type LessonPlanFiveEBreakdown = z.infer<
  typeof lessonPlanFiveEBreakdownSchema
>;

export const lessonPlanDayVocabularyDetailSchema = z.object({
  contextIntro: z.string().min(1),
  terms: z.array(lessonPlanVocabularyTermDetailSchema).min(1).max(12),
  fiveEBreakdown: lessonPlanFiveEBreakdownSchema.optional(),
  mainConcept: z
    .object({
      heading: z.string().min(1),
      body: z.string().min(1),
    })
    .optional(),
  process: z
    .object({
      heading: z.string().min(1),
      steps: z.array(lessonPlanProcessStepSchema).min(1).max(10),
    })
    .optional(),
  learningGoal: z
    .object({
      heading: z.string().min(1),
      intro: z.string().optional(),
      objectives: z.array(z.string().min(1)).min(1).max(10),
    })
    .optional(),
  additionalVocabulary: z.array(lessonPlanVocabularyTermDetailSchema).max(20).optional(),
});

export type LessonPlanDayVocabularyDetail = z.infer<
  typeof lessonPlanDayVocabularyDetailSchema
>;

/**
 * OpenAI structured outputs require every property in `required`.
 * Use `.nullable()` (not `.optional()`) for AI Output.object schemas.
 */
export const lessonPlanVocabularyTermDetailAiSchema = z.object({
  term: z.string().min(1),
  shortDefinition: z.string().min(1),
  definition: z.string().min(1),
  example: z.string().nullable(),
});

export const lessonPlanFiveEPhaseAiSchema = z.object({
  phase: z.enum(FIVE_E_PHASES),
  timeRange: z.string().min(1),
  activitySummary: z.string().min(1),
  detail: z.string().min(1),
  vocabularyFocus: z.array(z.string().min(1)).max(8),
  teacherMoves: z.array(z.string().min(1)).min(1).max(6),
  studentMoves: z.array(z.string().min(1)).min(1).max(6),
});

export const lessonPlanFiveEBreakdownAiSchema = z.object({
  heading: z.string().min(1),
  intro: z.string().nullable(),
  phases: z.array(lessonPlanFiveEPhaseAiSchema).min(5).max(5),
});

export const lessonPlanDayVocabularyDetailAiSchema = z.object({
  contextIntro: z.string().min(1),
  terms: z.array(lessonPlanVocabularyTermDetailAiSchema).min(1).max(12),
  fiveEBreakdown: lessonPlanFiveEBreakdownAiSchema.nullable(),
  mainConcept: z
    .object({
      heading: z.string().min(1),
      body: z.string().min(1),
    })
    .nullable(),
  process: z
    .object({
      heading: z.string().min(1),
      steps: z.array(lessonPlanProcessStepSchema).min(1).max(10),
    })
    .nullable(),
  learningGoal: z
    .object({
      heading: z.string().min(1),
      intro: z.string().nullable(),
      objectives: z.array(z.string().min(1)).min(1).max(10),
    })
    .nullable(),
  additionalVocabulary: z
    .array(lessonPlanVocabularyTermDetailAiSchema)
    .max(20)
    .nullable(),
});

export function coerceLessonPlanVocabularyTermDetail(
  term: z.infer<typeof lessonPlanVocabularyTermDetailAiSchema>,
): LessonPlanVocabularyTermDetail {
  return {
    term: term.term,
    shortDefinition: term.shortDefinition,
    definition: term.definition,
    ...(term.example ? { example: term.example } : {}),
  };
}

function coerceLessonPlanFiveEBreakdown(
  breakdown: z.infer<typeof lessonPlanFiveEBreakdownAiSchema>,
): LessonPlanFiveEBreakdown {
  return {
    heading: breakdown.heading,
    phases: breakdown.phases,
    ...(breakdown.intro ? { intro: breakdown.intro } : {}),
  };
}

export function coerceLessonPlanDayVocabularyDetail(
  detail: z.infer<typeof lessonPlanDayVocabularyDetailAiSchema>,
): LessonPlanDayVocabularyDetail {
  return {
    contextIntro: detail.contextIntro,
    terms: detail.terms.map(coerceLessonPlanVocabularyTermDetail),
    ...(detail.fiveEBreakdown
      ? { fiveEBreakdown: coerceLessonPlanFiveEBreakdown(detail.fiveEBreakdown) }
      : {}),
    ...(detail.mainConcept ? { mainConcept: detail.mainConcept } : {}),
    ...(detail.process ? { process: detail.process } : {}),
    ...(detail.learningGoal
      ? {
          learningGoal: {
            heading: detail.learningGoal.heading,
            objectives: detail.learningGoal.objectives,
            ...(detail.learningGoal.intro
              ? { intro: detail.learningGoal.intro }
              : {}),
          },
        }
      : {}),
    ...(detail.additionalVocabulary?.length
      ? {
          additionalVocabulary: detail.additionalVocabulary.map(
            coerceLessonPlanVocabularyTermDetail,
          ),
        }
      : {}),
  };
}

export const lessonPlanDaySchema = z.object({
  dayLabel: z.string().min(1),
  dayOfWeek: z.enum(TEACHER_CLASS_DAY_OPTIONS).optional(),
  dailyFocus: z.string().min(1),
  vocabulary: z.array(z.string().min(1)).min(1).max(8),
  lessonTimeline: z.array(z.string().min(1)).min(3).max(10),
  vocabularyDetail: lessonPlanDayVocabularyDetailSchema.optional(),
});

export type LessonPlanDaySchedule = z.infer<typeof lessonPlanDaySchema>;

/** Day shape for OpenAI lesson-plan generation (no nested vocabularyDetail). */
export const lessonPlanDayAiSchema = z.object({
  dayLabel: z.string().min(1),
  dayOfWeek: z.enum(TEACHER_CLASS_DAY_OPTIONS).nullable(),
  dailyFocus: z.string().min(1),
  vocabulary: z.array(z.string().min(1)).min(1).max(8),
  lessonTimeline: z.array(z.string().min(1)).min(3).max(10),
});

export const lessonPlanInputSchema = z.object({
  subject: z.string().min(1),
  gradeLevel: z.string().min(1),
  topic: z.string().min(1),
  lessonDuration: z.string().min(1),
  /** Number of school days the unit spans (1 = single lesson). */
  planPeriodDays: z.coerce.number().int().min(1).max(7).default(DEFAULT_PLAN_PERIOD_DAYS),
  difficultyLevel: lessonPlanDifficultySchema,
  learningStandard: z.string().optional(),
  classSize: z.string().optional(),
  specialInstructions: z.string().optional(),
  referenceMaterials: z
    .array(lessonPlanReferenceMaterialSchema)
    .max(MAX_LESSON_PLAN_REFERENCES)
    .optional(),
  referenceMaterialText: z.string().max(SOURCE_IMPORT_MAX_EXTRACTED_CHARS).optional(),
  referenceSourceSummary: z.string().max(500).optional(),
  regenerationSeed: z.number().int().nonnegative().optional(),
  vocabularyTeachingApproach: vocabularyTeachingApproachSchema.optional(),
});

export type LessonPlanActionInput = z.infer<typeof lessonPlanInputSchema>;

export const lessonPlanResultSchema = z.object({
  lessonTitle: z.string().min(1),
  learningObjectives: z.array(z.string().min(1)).min(3).max(8),
  materialsNeeded: z.array(z.string().min(1)).min(4).max(12),
  vocabulary: z.array(z.string().min(1)).min(6).max(20),
  lessonTimeline: z.array(z.string().min(1)).min(2).max(10),
  weeklySchedule: z.array(lessonPlanDaySchema).max(7).optional(),
  warmUpActivity: z.string().min(1),
  mainTeachingSteps: z.array(z.string().min(1)).min(5).max(10),
  classroomActivity: z.string().min(1),
  assessmentQuestions: z.array(z.string().min(1)).min(4).max(8),
  homework: z.string().min(1),
  differentiatedInstruction: z.array(z.string().min(1)).min(1).max(6),
  teacherNotes: z.string().min(1),
  /**
   * Set after generation when Learning Standard was confirmed Jamaica-linked.
   * Not produced by the AI schema — app metadata only.
   */
  jamaicaNscGuidelinesApplied: z.boolean().optional(),
});

/** Result shape for OpenAI Output.object — nullable instead of optional. */
export const lessonPlanResultAiSchema = z.object({
  lessonTitle: z.string().min(1),
  learningObjectives: z.array(z.string().min(1)).min(3).max(8),
  materialsNeeded: z.array(z.string().min(1)).min(4).max(12),
  vocabulary: z.array(z.string().min(1)).min(6).max(20),
  lessonTimeline: z.array(z.string().min(1)).min(2).max(10),
  weeklySchedule: z.array(lessonPlanDayAiSchema).max(7).nullable(),
  warmUpActivity: z.string().min(1),
  mainTeachingSteps: z.array(z.string().min(1)).min(5).max(10),
  classroomActivity: z.string().min(1),
  assessmentQuestions: z.array(z.string().min(1)).min(4).max(8),
  homework: z.string().min(1),
  differentiatedInstruction: z.array(z.string().min(1)).min(1).max(6),
  teacherNotes: z.string().min(1),
});

export function coerceLessonPlanResultAi(
  output: z.infer<typeof lessonPlanResultAiSchema>,
): z.infer<typeof lessonPlanResultSchema> {
  return {
    lessonTitle: output.lessonTitle,
    learningObjectives: output.learningObjectives,
    materialsNeeded: output.materialsNeeded,
    vocabulary: output.vocabulary,
    lessonTimeline: output.lessonTimeline,
    ...(output.weeklySchedule
      ? {
          weeklySchedule: output.weeklySchedule.map((day) => ({
            dayLabel: day.dayLabel,
            dailyFocus: day.dailyFocus,
            vocabulary: day.vocabulary,
            lessonTimeline: day.lessonTimeline,
            ...(day.dayOfWeek ? { dayOfWeek: day.dayOfWeek } : {}),
          })),
        }
      : {}),
    warmUpActivity: output.warmUpActivity,
    mainTeachingSteps: output.mainTeachingSteps,
    classroomActivity: output.classroomActivity,
    assessmentQuestions: output.assessmentQuestions,
    homework: output.homework,
    differentiatedInstruction: output.differentiatedInstruction,
    teacherNotes: output.teacherNotes,
  };
}
