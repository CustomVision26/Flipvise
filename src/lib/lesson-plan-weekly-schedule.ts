import type { LessonPlanDaySchedule } from "@/lib/lesson-plan-ai-schema";
import {
  DEFAULT_PLAN_PERIOD_DAYS,
  PLAN_PERIOD_DAY_OPTIONS,
  type PlanPeriodDays,
} from "@/lib/lesson-plan-ai-schema";

export { DEFAULT_PLAN_PERIOD_DAYS, PLAN_PERIOD_DAY_OPTIONS };
export type { PlanPeriodDays };

export function isPlanPeriodDays(value: number): value is PlanPeriodDays {
  return (PLAN_PERIOD_DAY_OPTIONS as readonly number[]).includes(value);
}

export function clampPlanPeriodDays(value: number): PlanPeriodDays {
  if (isPlanPeriodDays(value)) return value;
  if (value <= 1) return 1;
  if (value <= 3) return 3;
  if (value <= 5) return 5;
  return 7;
}

/** Human-readable unit header, e.g. "7-day unit · 45 minutes per class". */
export function formatUnitPacingLabel(
  planPeriodDays: number,
  lessonDuration: string,
): string {
  const duration = lessonDuration.trim() || "45 minutes";
  if (planPeriodDays <= 1) {
    return `Single lesson · ${duration}`;
  }
  return `${planPeriodDays}-day unit · ${duration} per class`;
}

/**
 * Pedagogically weighted day counts — intro/practice days may carry more terms;
 * review/closing days fewer. Sums exactly to `totalItems` with at least one term
 * per day when `totalItems >= days`.
 */
export function distributeCountsAcrossDays(
  totalItems: number,
  days: number,
): number[] {
  if (days <= 0) return [];
  if (totalItems <= 0) return Array.from({ length: days }, () => 0);
  if (totalItems < days) {
    return Array.from({ length: days }, (_, index) => (index < totalItems ? 1 : 0));
  }

  const counts = Array.from({ length: days }, () => 1);
  let remaining = totalItems - days;

  const weightPattern: Record<number, number[]> = {
    3: [1.35, 1.15, 0.85],
    5: [1.35, 1.25, 1.05, 1.15, 0.95],
    7: [1.2, 1.35, 0.95, 1.1, 1.15, 0.85, 0.8],
  };
  const weights =
    weightPattern[days as 3 | 5 | 7] ??
    Array.from({ length: days }, (_, index) => {
      const mid = (days - 1) / 2;
      return 1.1 - Math.abs(index - mid) * 0.08;
    });

  const dayOrder = weights
    .map((weight, index) => ({ index, weight }))
    .sort((a, b) => b.weight - a.weight)
    .map((entry) => entry.index);

  let ptr = 0;
  while (remaining > 0) {
    counts[dayOrder[ptr % dayOrder.length]!]++;
    remaining--;
    ptr++;
  }

  return counts;
}

export function distributeVocabularyAcrossDays(
  vocabulary: string[],
  days: number,
): string[][] {
  const counts = distributeCountsAcrossDays(vocabulary.length, days);
  const buckets: string[][] = [];
  let offset = 0;
  for (const count of counts) {
    buckets.push(vocabulary.slice(offset, offset + count));
    offset += count;
  }
  return buckets;
}

export function dayLabelForIndex(index: number, totalDays: number): string {
  if (totalDays === 5) {
    const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    return weekdays[index] ?? `Day ${index + 1}`;
  }
  if (totalDays === 7) {
    const weekdays = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    return weekdays[index] ?? `Day ${index + 1}`;
  }
  return `Day ${index + 1}`;
}

export function buildFallbackDayTimeline(
  topic: string,
  lessonDuration: string,
  termCount: number,
  difficulty: string,
): string[] {
  const duration = lessonDuration.trim() || "45 minutes";
  if (difficulty === "Beginner") {
    return [
      `5 min — Warm-up: review prior terms and activate background on ${topic}`,
      `10 min — Introduce ${termCount > 1 ? "new vocabulary" : "the vocabulary term"} with visuals and choral response`,
      `15 min — Guided practice applying today's terms to ${topic}`,
      `10 min — Small-group activity using the new words in context`,
      `5 min — Exit ticket and preview tomorrow's focus (${duration} total)`,
    ];
  }
  if (difficulty === "Advanced" || difficulty === "Honors/Gifted") {
    return [
      `5 min — Challenge warm-up connecting prior learning to ${topic}`,
      `10 min — Direct instruction on today's vocabulary and concept links`,
      `15 min — Independent or team application task`,
      `10 min — Peer discussion, defense of reasoning, or error analysis`,
      `5 min — Reflection and formative check (${duration} total)`,
    ];
  }
  return [
    `5 min — Warm-up and quick review`,
    `10 min — Teach ${termCount > 1 ? "today's vocabulary terms" : "today's vocabulary term"} for ${topic}`,
    `15 min — Guided practice with checkpoints`,
    `10 min — Collaborative application activity`,
    `5 min — Summary and exit ticket (${duration} total)`,
  ];
}

export function buildWeeklyScheduleFromVocabulary(input: {
  vocabulary: string[];
  planPeriodDays: number;
  lessonDuration: string;
  topic: string;
  difficulty: string;
}): LessonPlanDaySchedule[] {
  const days = clampPlanPeriodDays(input.planPeriodDays);
  if (days <= 1) return [];

  const buckets = distributeVocabularyAcrossDays(input.vocabulary, days);
  return buckets.map((terms, index) => ({
    dayLabel: dayLabelForIndex(index, days),
    dailyFocus:
      terms.length > 0
        ? `Introduce and practice ${terms.length} vocabulary term${terms.length === 1 ? "" : "s"} for ${input.topic}.`
        : `Review and consolidate ${input.topic} from earlier in the unit.`,
    vocabulary: terms.length > 0 ? terms : [`Review — key ideas from ${input.topic}`],
    lessonTimeline: buildFallbackDayTimeline(
      input.topic,
      input.lessonDuration,
      terms.length,
      input.difficulty,
    ),
  }));
}

export function flattenWeeklyVocabulary(
  schedule: LessonPlanDaySchedule[] | undefined,
): string[] {
  if (!schedule?.length) return [];
  return schedule.flatMap((day) => day.vocabulary);
}

export function weeklySchedulePromptBlock(
  planPeriodDays: number,
  lessonDuration: string,
): string {
  if (planPeriodDays <= 1) {
    return `Plan period: single class session. Lesson duration (${lessonDuration}) is the full class period. Put all vocabulary in the main vocabulary list and break ${lessonDuration} into the lessonTimeline segments. Do not populate weeklySchedule.`;
  }

  return `Plan period: ${planPeriodDays}-day unit. Each class period is ${lessonDuration} long (${formatUnitPacingLabel(planPeriodDays, lessonDuration)}).

Weekly schedule requirements (mandatory):
- Populate weeklySchedule with exactly ${planPeriodDays} entries (Day 1 … Day ${planPeriodDays}, or weekday names for 5- and 7-day plans).
- Distribute ALL vocabulary terms across the ${planPeriodDays} days using PEDAGOGICAL pacing — counts per day must vary naturally (e.g. 12 terms over 7 days might be 2, 3, 1, 2, 2, 1, 1). Heavier introduction days may have more new terms; review or assessment days may have fewer. Never give every day the same number of terms unless the topic truly requires it.
- Order terms logically: foundational concepts before dependent ones; pair related terms on the same day when helpful; reserve at least one lighter day for review or application.
- Each day's vocabulary array lists only the terms introduced or heavily practiced that day (format: "Term — definition").
- Each day's lessonTimeline must break that single ${lessonDuration} class period into timed segments (warm-up, instruction, practice, assessment) that add up to ${lessonDuration}, explicitly referencing that day's vocabulary terms.
- dailyFocus must state what that day covers in one clear sentence.
- The root vocabulary array must still list every term for the full unit (combined master list).
- Root lessonTimeline must be a 2–4 bullet unit pacing overview (which themes land on which days); detailed timing lives only in weeklySchedule.
- warmUpActivity, mainTeachingSteps, classroomActivity, homework, and assessment should describe the full ${planPeriodDays}-day unit arc while weeklySchedule holds day-by-day pacing.`;
}

/** True when AI returned a complete per-day schedule worth keeping. */
export function isUsableWeeklySchedule(
  schedule: LessonPlanDaySchedule[] | undefined,
  planPeriodDays: number,
  vocabularyCount: number,
): boolean {
  if (!schedule || schedule.length !== planPeriodDays) return false;
  if (schedule.some((day) => day.vocabulary.length < 1 || day.lessonTimeline.length < 3)) {
    return false;
  }
  const scheduledCount = schedule.reduce((sum, day) => sum + day.vocabulary.length, 0);
  if (scheduledCount < vocabularyCount) return false;
  return true;
}

export function reconcileWeeklySchedule(input: {
  vocabulary: string[];
  weeklySchedule: LessonPlanDaySchedule[] | undefined;
  planPeriodDays: number;
  lessonDuration: string;
  topic: string;
  difficulty: string;
}): LessonPlanDaySchedule[] {
  const days = clampPlanPeriodDays(input.planPeriodDays);
  if (days <= 1) return [];

  if (
    isUsableWeeklySchedule(
      input.weeklySchedule,
      days,
      input.vocabulary.length,
    )
  ) {
    return input.weeklySchedule!;
  }

  return buildWeeklyScheduleFromVocabulary({
    vocabulary: input.vocabulary,
    planPeriodDays: days,
    lessonDuration: input.lessonDuration,
    topic: input.topic,
    difficulty: input.difficulty,
  });
}
