export const TEACHER_CLASS_DAY_OPTIONS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const TEACHER_CLASS_TERM_OPTIONS = [
  "Fall",
  "Spring",
  "Summer",
  "Semester 1",
  "Semester 2",
  "Trimester 1",
  "Trimester 2",
  "Trimester 3",
] as const;

export const TEACHER_CLASS_DECK_NONE = "__none__";

export function periodOfTheDayLabel(dayNumber: number): string {
  return `Period of the day ${dayNumber}`;
}

export function periodPlaceholder(dayNumber: number): string {
  return `Period ${dayNumber}`;
}

export function formatPlanPeriodLabel(planPeriodDays: number): string {
  return planPeriodDays === 1 ? "1 day (single lesson)" : String(planPeriodDays);
}

export function formatStoredClassPeriods(periodValues: string[]): string {
  return periodValues.map((entry) => entry.trim()).join(" · ");
}

export function parseStoredClassPeriods(period: string): string[] {
  const trimmed = period.trim();
  if (!trimmed) {
    return [];
  }

  const parts = trimmed
    .split(" · ")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return [];
  }

  const labeledValues = parts.map((entry) => {
    const match =
      entry.match(/^Period of the day\s+\d+:\s*(.+)$/i) ??
      entry.match(/^Period\s+\d+:\s*(.+)$/i);
    return match ? match[1].trim() : null;
  });

  if (labeledValues.every((value) => value != null)) {
    return labeledValues;
  }

  if (parts.length > 1) {
    return parts;
  }

  return [trimmed];
}

export function buildPeriodFieldsForPlanPeriod(
  planPeriodDays: number | null,
  existingPeriod?: string,
): {
  day: string;
  period: string;
  periods: string[];
} {
  if (planPeriodDays == null) {
    return {
      day: "",
      period: existingPeriod ?? "",
      periods: [],
    };
  }

  const parsedPeriods = existingPeriod ? parseStoredClassPeriods(existingPeriod) : [];
  return {
    day: String(planPeriodDays),
    period: "",
    periods: Array.from(
      { length: planPeriodDays },
      (_, index) => parsedPeriods[index] ?? "",
    ),
  };
}

export function buildClassPeriodStateForDeck(
  deckId: number,
  planPeriodDaysByDeckId: Record<number, number>,
  existingPeriod?: string,
): {
  day: string;
  period: string;
  periods: string[];
} {
  const planPeriod = planPeriodDaysByDeckId[deckId];
  return buildPeriodFieldsForPlanPeriod(
    planPeriod != null ? planPeriod : null,
    existingPeriod,
  );
}
