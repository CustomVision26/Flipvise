import planDefaults from "@/data/ai-usage-plan-defaults.json";

export const AI_USAGE_PLATFORM_TIMEZONE =
  process.env.AI_USAGE_TIMEZONE?.trim() || planDefaults.timezone || "America/Jamaica";

/** Format a Date as YYYY-MM-DD in the platform admin timezone. */
export function formatDateInTimezone(date: Date, timeZone = AI_USAGE_PLATFORM_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** Approximate UTC instant for local midnight in a timezone (good enough for period bounds). */
export function zonedMidnightUtc(
  year: number,
  month: number,
  day: number,
  timeZone = AI_USAGE_PLATFORM_TIMEZONE,
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const parts = zonedParts(guess, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const desired = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offset = asUtc - desired;
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - offset);
}

export type UsagePeriod = {
  start: Date;
  end: Date;
  label: string;
};

/** Calendar-month usage period in the platform timezone. */
export function resolveCalendarMonthPeriod(
  at: Date = new Date(),
  timeZone = AI_USAGE_PLATFORM_TIMEZONE,
): UsagePeriod {
  const parts = zonedParts(at, timeZone);
  const start = zonedMidnightUtc(parts.year, parts.month, 1, timeZone);
  const nextMonth = parts.month === 12 ? 1 : parts.month + 1;
  const nextYear = parts.month === 12 ? parts.year + 1 : parts.year;
  const end = zonedMidnightUtc(nextYear, nextMonth, 1, timeZone);
  return {
    start,
    end,
    label: `${parts.year}-${String(parts.month).padStart(2, "0")}`,
  };
}

/**
 * Prefer Stripe billing period when `currentPeriodEnd` is known (derive start as
 * one month before end for monthly, or calendar month fallback).
 */
export function resolveUsagePeriod(params: {
  at?: Date;
  stripeCurrentPeriodEnd?: Date | null;
  billingInterval?: "month" | "year" | null;
}): UsagePeriod {
  const at = params.at ?? new Date();
  const periodEnd = params.stripeCurrentPeriodEnd;
  if (periodEnd && periodEnd.getTime() > at.getTime()) {
    const end = periodEnd;
    const start = new Date(end);
    if (params.billingInterval === "year") {
      start.setUTCFullYear(start.getUTCFullYear() - 1);
    } else {
      start.setUTCMonth(start.getUTCMonth() - 1);
    }
    if (start.getTime() <= at.getTime() && at.getTime() < end.getTime()) {
      return {
        start,
        end,
        label: "billing_period",
      };
    }
  }
  return resolveCalendarMonthPeriod(at);
}

export function resolveDateRangePreset(
  preset: string,
  customFrom?: string | null,
  customTo?: string | null,
  timeZone = AI_USAGE_PLATFORM_TIMEZONE,
): { start: Date; end: Date; preset: string } {
  const now = new Date();
  const todayParts = zonedParts(now, timeZone);
  const todayStart = zonedMidnightUtc(todayParts.year, todayParts.month, todayParts.day, timeZone);
  const tomorrow = new Date(todayStart);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  switch (preset) {
    case "today":
      return { start: todayStart, end: tomorrow, preset };
    case "last_7_days": {
      const start = new Date(todayStart);
      start.setUTCDate(start.getUTCDate() - 6);
      return { start, end: tomorrow, preset };
    }
    case "last_30_days": {
      const start = new Date(todayStart);
      start.setUTCDate(start.getUTCDate() - 29);
      return { start, end: tomorrow, preset };
    }
    case "current_billing_period":
    case "current_month": {
      const month = resolveCalendarMonthPeriod(now, timeZone);
      return { start: month.start, end: month.end, preset };
    }
    case "custom": {
      if (!customFrom || !customTo) {
        const month = resolveCalendarMonthPeriod(now, timeZone);
        return { start: month.start, end: month.end, preset: "current_month" };
      }
      const [fy, fm, fd] = customFrom.split("-").map(Number);
      const [ty, tm, td] = customTo.split("-").map(Number);
      const start = zonedMidnightUtc(fy, fm, fd, timeZone);
      const endExclusive = zonedMidnightUtc(ty, tm, td, timeZone);
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
      const maxMs = planDefaults.maxDateRangeDays * 24 * 60 * 60 * 1000;
      if (endExclusive.getTime() - start.getTime() > maxMs) {
        const clamped = new Date(endExclusive.getTime() - maxMs);
        return { start: clamped, end: endExclusive, preset };
      }
      return { start, end: endExclusive, preset };
    }
    default: {
      const month = resolveCalendarMonthPeriod(now, timeZone);
      return { start: month.start, end: month.end, preset: "current_month" };
    }
  }
}

export function previousEquivalentRange(start: Date, end: Date): { start: Date; end: Date } {
  const duration = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - duration),
    end: new Date(start.getTime()),
  };
}
