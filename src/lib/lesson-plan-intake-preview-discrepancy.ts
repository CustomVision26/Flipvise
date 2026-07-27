import { DEFAULT_PLAN_PERIOD_DAYS } from "@/lib/lesson-plan-weekly-schedule";
import type { LessonPlanInput, LessonPlanResult } from "@/lib/teacher-generators";

export type LessonPlanIntakePreviewDiscrepancy = {
  field: string;
  /** Current Input UI (form) value */
  inputValue: string;
  /** Value reflected by the current preview / last-synced intake */
  previewValue: string;
};

/** Intake fields compared for exit-navigation discrepancy detection. */
export function cloneComparableLessonPlanIntake(
  input: LessonPlanInput,
): LessonPlanInput {
  return {
    subject: input.subject ?? "",
    gradeLevel: input.gradeLevel ?? "",
    topic: input.topic ?? "",
    lessonDuration: input.lessonDuration ?? "",
    planPeriodDays: input.planPeriodDays ?? DEFAULT_PLAN_PERIOD_DAYS,
    difficultyLevel: input.difficultyLevel ?? "",
    learningStandard: input.learningStandard ?? "",
    classSize: input.classSize ?? "",
  };
}

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

function valueReflectedInText(haystack: string, value: string): boolean {
  const needle = displayValue(value).toLowerCase();
  if (!needle) return true;
  return displayValue(haystack).toLowerCase().includes(needle);
}

function formatPlanPeriodLabel(days: number | undefined): string {
  const planPeriodDays = days ?? DEFAULT_PLAN_PERIOD_DAYS;
  return planPeriodDays <= 1
    ? "1 day (single lesson)"
    : `${planPeriodDays}-day unit`;
}

/**
 * Best-effort parse of common title shapes, e.g.
 * `Linear equations — Math (Grade 8)`.
 */
export function parseLessonTitleCues(lessonTitle: string): {
  topic?: string;
  subject?: string;
  gradeLevel?: string;
} {
  const title = displayValue(lessonTitle);
  if (!title) return {};

  const withGrade = title.match(
    /^(.+?)\s+[—–-]\s+(.+?)\s*\(([^)]+)\)\s*$/,
  );
  if (withGrade) {
    return {
      topic: displayValue(withGrade[1]),
      subject: displayValue(withGrade[2]),
      gradeLevel: displayValue(withGrade[3]),
    };
  }

  const dashed = title.match(/^(.+?)\s+[—–-]\s+(.+)$/);
  if (dashed) {
    return {
      topic: displayValue(dashed[1]),
      subject: displayValue(dashed[2]),
    };
  }

  return {};
}

/**
 * Extract full-class lesson duration from preview content.
 * Ignores segment labels like "0-5 min: Engage" that previously polluted Preview.
 */
function extractDurationCue(
  result: LessonPlanResult,
  syncedDuration: string,
): string | null {
  const synced = displayValue(syncedDuration);
  if (synced) return synced;

  const timelineBits = [
    ...(result.lessonTimeline ?? []),
    ...(result.weeklySchedule?.flatMap((day) => day.lessonTimeline ?? []) ??
      []),
  ];
  const blob = timelineBits.join(" ");

  const totalMatch = blob.match(
    /\((\d+\s*(?:minutes?|mins?|hours?|hrs?))\s*total\)/i,
  );
  if (totalMatch) return displayValue(totalMatch[1]);

  const perClassMatch = blob.match(
    /(\d+\s*(?:minutes?|mins?|hours?|hrs?))\s*per\s*class/i,
  );
  if (perClassMatch) return displayValue(perClassMatch[1]);

  // Prefer whole-class durations (typically 20+ minutes), never segment bounds.
  const wholeClassMatches = [
    ...blob.matchAll(/\b(\d+)\s*(minutes?|mins?|hours?|hrs?)\b/gi),
  ];
  for (const match of wholeClassMatches) {
    const amount = Number(match[1]);
    const unit = displayValue(match[2]).toLowerCase();
    if (!Number.isFinite(amount)) continue;
    const isHours = unit.startsWith("hour") || unit.startsWith("hr");
    if (isHours || amount >= 20) {
      return displayValue(`${match[1]} ${match[2]}`);
    }
  }

  return null;
}

/**
 * Compare current Input UI intake against the intake last synced to the preview
 * and against cues from the preview result (title, schedule length, duration).
 */
export function buildLessonPlanIntakePreviewDiscrepancies(
  form: LessonPlanInput,
  result: LessonPlanResult,
  syncedIntake: LessonPlanInput,
): LessonPlanIntakePreviewDiscrepancy[] {
  const title = displayValue(result.lessonTitle);
  const inferred = parseLessonTitleCues(title);
  const scheduleDayCount = result.weeklySchedule?.length ?? 0;
  const durationCue = extractDurationCue(result, syncedIntake.lessonDuration);

  const rows: Array<{
    field: string;
    input: string;
    synced: string;
    previewCue?: string | null;
    titleReflectsInput?: boolean;
    /** When true, Preview prefers synced intake over result cues. */
    preferSyncedPreview?: boolean;
  }> = [
    {
      field: "Subject",
      input: form.subject,
      synced: syncedIntake.subject,
      previewCue: inferred.subject,
      titleReflectsInput: valueReflectedInText(title, form.subject),
    },
    {
      field: "Topic",
      input: form.topic,
      synced: syncedIntake.topic,
      previewCue: inferred.topic,
      titleReflectsInput: valueReflectedInText(title, form.topic),
    },
    {
      field: "Grade level",
      input: form.gradeLevel,
      synced: syncedIntake.gradeLevel,
      previewCue: inferred.gradeLevel,
      titleReflectsInput: valueReflectedInText(title, form.gradeLevel),
    },
    {
      field: "Difficulty",
      input: form.difficultyLevel,
      synced: syncedIntake.difficultyLevel,
      preferSyncedPreview: true,
    },
    {
      field: "Lesson duration",
      input: form.lessonDuration,
      synced: syncedIntake.lessonDuration,
      previewCue: durationCue,
      preferSyncedPreview: true,
    },
    {
      field: "Plan period",
      input: formatPlanPeriodLabel(form.planPeriodDays),
      synced: formatPlanPeriodLabel(syncedIntake.planPeriodDays),
      previewCue:
        scheduleDayCount > 0 ? formatPlanPeriodLabel(scheduleDayCount) : null,
    },
    {
      field: "Learning standard",
      input: form.learningStandard ?? "",
      synced: syncedIntake.learningStandard ?? "",
      preferSyncedPreview: true,
    },
    {
      field: "Class size",
      input: form.classSize ?? "",
      synced: syncedIntake.classSize ?? "",
      preferSyncedPreview: true,
    },
  ];

  const discrepancies: LessonPlanIntakePreviewDiscrepancy[] = [];

  for (const row of rows) {
    const inputDisplay = displayValue(row.input);
    const syncedDisplay = displayValue(row.synced);
    const cueDisplay =
      row.previewCue != null ? displayValue(row.previewCue) : "";

    const intakeDrift = !valuesEqual(inputDisplay, syncedDisplay);
    const cueConflict =
      !row.preferSyncedPreview &&
      cueDisplay.length > 0 &&
      !valuesEqual(inputDisplay, cueDisplay) &&
      row.titleReflectsInput !== true;

    if (!intakeDrift && !cueConflict) continue;

    const previewValue = row.preferSyncedPreview
      ? syncedDisplay || cueDisplay
      : cueConflict
        ? cueDisplay
        : syncedDisplay || cueDisplay;

    if (valuesEqual(inputDisplay, previewValue)) continue;

    discrepancies.push({
      field: row.field,
      inputValue: inputDisplay || "(empty)",
      previewValue: previewValue || "(empty)",
    });
  }

  const coreDrift = discrepancies.some(
    (item) => item.field === "Subject" || item.field === "Topic",
  );
  if (title && coreDrift) {
    const intakeTitleHint = [displayValue(form.topic), displayValue(form.subject)]
      .filter(Boolean)
      .join(" — ");
    discrepancies.unshift({
      field: "Lesson title",
      inputValue: intakeTitleHint || "(from intake)",
      previewValue: title,
    });
  }

  return discrepancies;
}

export function hasLessonPlanIntakePreviewDiscrepancy(
  form: LessonPlanInput,
  result: LessonPlanResult | null | undefined,
  syncedIntake: LessonPlanInput | null | undefined,
): boolean {
  if (!result || !syncedIntake) return false;
  return (
    buildLessonPlanIntakePreviewDiscrepancies(form, result, syncedIntake)
      .length > 0
  );
}
