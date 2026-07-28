import {
  isLessonPlanDayScopeAll,
  type LessonPlanDayScope,
} from "@/lib/lesson-plan-day-scope";

/** Stable segment stored in quiz-deck descriptions when generated from a lesson plan. */
export const LESSON_SCOPE_DESCRIPTION_PREFIX = "Lesson scope:";

const DEFAULT_TITLE_MAX = 72;
const DEFAULT_COMBINED_MAX = 110;

export function shortenTeacherTitleSegment(
  text: string,
  maxLen = DEFAULT_TITLE_MAX,
): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, Math.max(1, maxLen - 1)).trimEnd()}…`;
}

/**
 * Compact day-scope label for titles and resource cards.
 * Prefer `Day N` over long weekday captions when a full dayLabel is present.
 */
export function formatCompactDayScopeLabel(
  scope: LessonPlanDayScope | null | undefined,
): string | null {
  if (scope == null) return null;
  if (isLessonPlanDayScopeAll(scope)) return "All Days";
  const labeled = scope.dayLabel?.trim();
  if (labeled) {
    const dayMatch = /^Day\s+(\d+)\b/i.exec(labeled);
    if (dayMatch) return `Day ${dayMatch[1]}`;
    return shortenTeacherTitleSegment(labeled, 28);
  }
  return `Day ${scope.dayIndex + 1}`;
}

export function formatLessonScopeDescriptionSegment(
  scope: LessonPlanDayScope | null | undefined,
): string | null {
  const label = formatCompactDayScopeLabel(scope);
  if (!label) return null;
  return `${LESSON_SCOPE_DESCRIPTION_PREFIX} ${label}`;
}

/** Parse `Lesson scope: All Days` / `Lesson scope: Day 1` from a deck description. */
export function parseLessonScopeLabelFromDescription(
  description: string | null | undefined,
): string | null {
  if (!description?.trim()) return null;
  const match = new RegExp(
    `${LESSON_SCOPE_DESCRIPTION_PREFIX}\\s*([^·\\n]+)`,
    "i",
  ).exec(description);
  const raw = match?.[1]?.trim();
  if (!raw) return null;
  if (/^all\s*days$/i.test(raw)) return "All Days";
  const dayMatch = /^Day\s+(\d+)\b/i.exec(raw);
  if (dayMatch) return `Day ${dayMatch[1]}`;
  return shortenTeacherTitleSegment(raw, 28);
}

/**
 * Short quiz/lesson deck name: prefer a Subject : Course style subject alone,
 * and avoid stuffing long comma-separated skill lists into the name.
 */
export function buildShortTeacherDeckName(
  subject: string,
  topic: string,
  maxLen = DEFAULT_TITLE_MAX,
): string {
  const subj = subject.trim().replace(/\s+/g, " ");
  const top = topic.trim().replace(/\s+/g, " ");
  if (!subj && !top) return "Quiz deck";
  if (!subj) return shortenTeacherTitleSegment(top, maxLen);

  const subjectAlreadyDescriptive = /[—–:]/.test(subj);
  const topicLooksLikeSkillList =
    top.length > 48 || (top.includes(",") && top.split(",").length >= 3);

  if (subjectAlreadyDescriptive || topicLooksLikeSkillList || !top) {
    return shortenTeacherTitleSegment(subj, maxLen);
  }

  return shortenTeacherTitleSegment(`${subj} — ${top}`, maxLen);
}

export function buildGenerationTitleSourceSuffix(input: {
  sourceType?: "lesson_plan" | "deck" | "topic" | string | null;
  dayScope?: LessonPlanDayScope | null;
  deckName?: string | null;
  /** Day/All Days parsed from a source deck description. */
  deckLessonScopeLabel?: string | null;
}): string {
  const parts: string[] = [];
  const sourceType = input.sourceType ?? null;

  if (sourceType === "deck" && input.deckName?.trim()) {
    parts.push(`Deck: ${shortenTeacherTitleSegment(input.deckName, 40)}`);
  }

  if (sourceType === "lesson_plan" || input.dayScope != null) {
    const day = formatCompactDayScopeLabel(input.dayScope ?? "all");
    if (day) parts.push(day);
  }

  if (sourceType === "deck" && input.deckLessonScopeLabel?.trim()) {
    parts.push(input.deckLessonScopeLabel.trim());
  }

  return parts.join(" · ");
}

/** Append a source/day suffix to a base title without exceeding max length. */
export function withTitleSourceSuffix(
  baseTitle: string,
  suffix: string,
  maxLen = DEFAULT_COMBINED_MAX,
): string {
  const base = baseTitle.trim().replace(/\s+/g, " ");
  const cleanSuffix = suffix.trim();
  if (!cleanSuffix) return shortenTeacherTitleSegment(base, maxLen);
  if (!base) return shortenTeacherTitleSegment(cleanSuffix, maxLen);

  const separator = " · ";
  const budget = Math.max(24, maxLen - cleanSuffix.length - separator.length);
  const shortenedBase = shortenTeacherTitleSegment(base, budget);
  return shortenTeacherTitleSegment(
    `${shortenedBase}${separator}${cleanSuffix}`,
    maxLen,
  );
}
