export type QuizStartScheduleSource = "deck" | "workspace";

export type ResolvedQuizStartSchedule = {
  enabled: boolean;
  startAt: Date;
  source: QuizStartScheduleSource;
};

export type QuizStartScheduleFields = {
  quizStartScheduleEnabled: boolean;
  quizStartAt: Date | null;
};

/** `datetime-local` value (`YYYY-MM-DDTHH:mm`) in the viewer's local timezone. */
export function toDatetimeLocalValue(value: Date | string | null | undefined): string {
  if (value == null) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parse a `datetime-local` string as local wall-clock time. */
export function parseDatetimeLocal(value: string): Date {
  return new Date(value);
}

export function formatQuizStartSchedule(value: Date | string): string {
  try {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(value);
  }
}

export function resolveQuizStartSchedule(
  deck: QuizStartScheduleFields,
  workspace: QuizStartScheduleFields,
): ResolvedQuizStartSchedule | null {
  if (deck.quizStartScheduleEnabled && deck.quizStartAt) {
    return {
      enabled: true,
      startAt: deck.quizStartAt,
      source: "deck",
    };
  }
  if (workspace.quizStartScheduleEnabled && workspace.quizStartAt) {
    return {
      enabled: true,
      startAt: workspace.quizStartAt,
      source: "workspace",
    };
  }
  return null;
}

export function isQuizStartAllowed(
  schedule: ResolvedQuizStartSchedule | null,
  now: Date = new Date(),
): boolean {
  if (!schedule?.enabled) return true;
  return now.getTime() >= schedule.startAt.getTime();
}

export function secondsUntilQuizStart(
  schedule: ResolvedQuizStartSchedule | null,
  now: Date = new Date(),
): number {
  if (!schedule?.enabled) return 0;
  return Math.max(0, Math.ceil((schedule.startAt.getTime() - now.getTime()) / 1000));
}

export function formatCountdown(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
