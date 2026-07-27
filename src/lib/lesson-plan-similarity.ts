import { DEFAULT_PLAN_PERIOD_DAYS } from "@/lib/lesson-plan-weekly-schedule";
import type { LessonPlanInput, LessonPlanResult } from "@/lib/teacher-generators";

function displayValue(value: string | number | undefined | null): string {
  if (value == null) return "";
  return String(value).trim().replace(/\s+/g, " ");
}

function valuesEqual(
  a: string | number | undefined | null,
  b: string | number | undefined | null,
): boolean {
  return displayValue(a).toLowerCase() === displayValue(b).toLowerCase();
}

/** Deterministic JSON for result / nested comparison. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sortKeysDeep(record[key])]),
    );
  }
  return value;
}

export type LessonPlanComparableSnapshot = {
  input: LessonPlanInput;
  result: LessonPlanResult;
};

/**
 * Practical similarity for assignee personal-copy overwrite skip.
 * Compares intake core fields, lesson title, and a stable result JSON fingerprint.
 */
export function areLessonPlanSnapshotsSimilar(
  a: LessonPlanComparableSnapshot,
  b: LessonPlanComparableSnapshot,
): boolean {
  const aDays = a.input.planPeriodDays ?? DEFAULT_PLAN_PERIOD_DAYS;
  const bDays = b.input.planPeriodDays ?? DEFAULT_PLAN_PERIOD_DAYS;

  return (
    valuesEqual(a.input.subject, b.input.subject) &&
    valuesEqual(a.input.gradeLevel, b.input.gradeLevel) &&
    valuesEqual(a.input.topic, b.input.topic) &&
    valuesEqual(a.input.difficultyLevel, b.input.difficultyLevel) &&
    valuesEqual(a.input.lessonDuration, b.input.lessonDuration) &&
    aDays === bDays &&
    valuesEqual(a.input.learningStandard, b.input.learningStandard) &&
    valuesEqual(a.result.lessonTitle, b.result.lessonTitle) &&
    stableStringify(a.result) === stableStringify(b.result)
  );
}

/**
 * Broader equality for edit-mode dirty detection (includes class size,
 * accommodations, and reference materials).
 */
export function areLessonPlanEditorStatesEqual(
  a: LessonPlanComparableSnapshot,
  b: LessonPlanComparableSnapshot,
): boolean {
  if (!areLessonPlanSnapshotsSimilar(a, b)) return false;

  return (
    valuesEqual(a.input.classSize, b.input.classSize) &&
    valuesEqual(a.input.specialInstructions, b.input.specialInstructions) &&
    stableStringify(a.input.referenceMaterials ?? []) ===
      stableStringify(b.input.referenceMaterials ?? [])
  );
}

export function isLessonPlanEditorStateDirty(
  current: LessonPlanComparableSnapshot,
  baseline: LessonPlanComparableSnapshot,
): boolean {
  return !areLessonPlanEditorStatesEqual(current, baseline);
}
