import { z } from "zod";
import type { LessonPlanDaySchedule } from "@/lib/lesson-plan-ai-schema";
import {
  formatLessonPlanDayLabel,
  normalizeLessonPlanDayEntry,
} from "@/lib/lesson-plan-weekly-schedule";
import type { LessonPlanResult } from "@/lib/teacher-generators";

/** Generate from the full multi-day lesson plan. */
export const LESSON_PLAN_DAY_SCOPE_ALL = "all" as const;

export const lessonPlanDayScopeSchema = z.union([
  z.literal(LESSON_PLAN_DAY_SCOPE_ALL),
  z.object({
    /** 0-based index into `weeklySchedule`. */
    dayIndex: z.number().int().min(0).max(6),
    /** Display label at confirm time (optional; server resolves from schedule). */
    dayLabel: z.string().min(1).optional(),
  }),
]);

export type LessonPlanDayScope = z.infer<typeof lessonPlanDayScopeSchema>;

export type LessonPlanDayScopeOption = {
  /** Stable radio value: `"all"` or `"day:0"`. */
  value: string;
  label: string;
  /** Muted helper under the label (daily focus, vocab preview, etc.). */
  caption?: string;
  scope: LessonPlanDayScope;
};

const DAY_SCOPE_CAPTION_MAX = 72;

function truncateDayScopeCaption(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= DAY_SCOPE_CAPTION_MAX) return trimmed;
  return `${trimmed.slice(0, DAY_SCOPE_CAPTION_MAX - 1).trimEnd()}…`;
}

/**
 * Short secondary line for a schedule day: prefer daily focus, else first vocab terms.
 * Returns undefined when neither is available (label-only fallback).
 */
export function formatLessonPlanDayScopeCaption(
  day: Pick<LessonPlanDaySchedule, "dailyFocus" | "vocabulary">,
): string | undefined {
  const focus = day.dailyFocus?.trim();
  if (focus) return truncateDayScopeCaption(focus);

  const terms = (day.vocabulary ?? [])
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (terms.length === 0) return undefined;
  return truncateDayScopeCaption(terms.join(", "));
}

export function isLessonPlanDayScopeAll(
  scope: LessonPlanDayScope | null | undefined,
): scope is typeof LESSON_PLAN_DAY_SCOPE_ALL | null | undefined {
  return scope == null || scope === LESSON_PLAN_DAY_SCOPE_ALL;
}

export function lessonPlanDayScopeRadioValue(scope: LessonPlanDayScope): string {
  if (scope === LESSON_PLAN_DAY_SCOPE_ALL) return LESSON_PLAN_DAY_SCOPE_ALL;
  return `day:${scope.dayIndex}`;
}

export function parseLessonPlanDayScopeRadioValue(
  value: string,
): LessonPlanDayScope | null {
  if (value === LESSON_PLAN_DAY_SCOPE_ALL) return LESSON_PLAN_DAY_SCOPE_ALL;
  const match = /^day:(\d+)$/.exec(value);
  if (!match) return null;
  const dayIndex = Number(match[1]);
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) return null;
  return { dayIndex };
}

/** Display label for a schedule day, e.g. `Day 1 (Monday)` or `Day 1`. */
export function formatLessonPlanDayScopeLabel(
  day: LessonPlanDaySchedule,
  index: number,
): string {
  const normalized = normalizeLessonPlanDayEntry(day, index);
  if (normalized.dayLabel.trim()) return normalized.dayLabel.trim();
  return formatLessonPlanDayLabel(index + 1, normalized.dayOfWeek);
}

/**
 * Radio options for the day-scope dialog.
 * Returns an empty list when the plan has fewer than 2 schedule days
 * (caller should skip the dialog).
 */
export function getLessonPlanDayScopeOptions(
  result: Pick<LessonPlanResult, "weeklySchedule"> | null | undefined,
): LessonPlanDayScopeOption[] {
  const schedule = result?.weeklySchedule ?? [];
  if (schedule.length < 2) return [];

  return [
    {
      value: LESSON_PLAN_DAY_SCOPE_ALL,
      label: "All Days",
      caption: "Vocabulary, focus, and outlines from every day in the plan",
      scope: LESSON_PLAN_DAY_SCOPE_ALL,
    },
    ...schedule.map((day, index) => {
      const label = formatLessonPlanDayScopeLabel(day, index);
      const caption = formatLessonPlanDayScopeCaption(day);
      return {
        value: `day:${index}`,
        label,
        ...(caption ? { caption } : {}),
        scope: { dayIndex: index, dayLabel: label } satisfies LessonPlanDayScope,
      };
    }),
  ];
}

/** True when the AI Generate day-scope dialog should open. */
export function shouldPromptLessonPlanDayScope(
  result: Pick<LessonPlanResult, "weeklySchedule"> | null | undefined,
): boolean {
  return getLessonPlanDayScopeOptions(result).length > 0;
}

export function resolveScopedLessonPlanDay(
  result: LessonPlanResult,
  scope: LessonPlanDayScope,
): LessonPlanDaySchedule | null {
  if (isLessonPlanDayScopeAll(scope)) return null;
  const schedule = result.weeklySchedule ?? [];
  const day = schedule[scope.dayIndex];
  return day ?? null;
}
