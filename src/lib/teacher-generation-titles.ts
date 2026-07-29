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

/** Parse `LP Day 2` / `LP All Days` from a deck name suffix. */
export function parseLessonScopeLabelFromDeckName(
  name: string | null | undefined,
): string | null {
  if (!name?.trim()) return null;
  const match = /\bLP\s+(All Days|Day\s+\d+)\s*$/i.exec(name.trim());
  if (!match?.[1]) return null;
  const raw = match[1].trim();
  if (/^all\s*days$/i.test(raw)) return "All Days";
  const dayMatch = /^Day\s+(\d+)\b/i.exec(raw);
  if (dayMatch) return `Day ${dayMatch[1]}`;
  return null;
}

/** Title/badge text: `Lesson Plan Day 2` or `Lesson Plan All Days`. */
export function formatLessonPlanDayScopeTitleLabel(
  scope: LessonPlanDayScope | null | undefined,
): string | null {
  const compact = formatCompactDayScopeLabel(scope);
  if (!compact) return null;
  if (compact === "All Days") return "Lesson Plan All Days";
  if (/^Day\s+\d+\b/i.test(compact)) return `Lesson Plan ${compact}`;
  return `Lesson Plan ${compact}`;
}

/**
 * Dashboard / list badge text: `Lesson Plan Day 2` or `Lesson Plan All Days`.
 * Prefers description `Lesson scope:` then name `LP Day N` suffix.
 */
export function formatLessonPlanDayCardLabel(
  description: string | null | undefined,
  name?: string | null,
): string | null {
  const scope =
    parseLessonScopeLabelFromDescription(description) ??
    parseLessonScopeLabelFromDeckName(name);
  if (!scope) return null;
  if (scope === "All Days") return "Lesson Plan All Days";
  if (/^Day\s+\d+\b/i.test(scope)) return `Lesson Plan ${scope}`;
  return `Lesson Plan ${scope}`;
}

/** Shorter title for deck cards when the name embeds a long topic list or LP day suffix. */
export function formatDeckCardDisplayName(name: string): string {
  const withoutLp = stripLessonPlanScopedDeckSuffix(name);
  const parts = withoutLp.split(/\s+[—–]\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2 && (parts[1]?.length ?? 0) > 36) {
    return shortenTeacherTitleSegment(parts[0]!, DEFAULT_TITLE_MAX);
  }
  return shortenTeacherTitleSegment(withoutLp, DEFAULT_TITLE_MAX);
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

const LP_SCOPED_DECK_SUFFIX = /\s+LP\s+(All Days|Day\s+\d+)\s*$/i;

/** Strip a trailing ` LP Day N` / ` LP All Days` suffix from a deck name. */
export function stripLessonPlanScopedDeckSuffix(name: string): string {
  return name.trim().replace(LP_SCOPED_DECK_SUFFIX, "").trim();
}

/**
 * Day-scoped quiz deck name under a linked lesson-plan deck.
 * e.g. `Deck1 LP Day 2` or `Deck1 LP All Days`.
 */
export function buildLessonPlanScopedDeckName(
  baseDeckName: string,
  dayScope: LessonPlanDayScope | null | undefined,
  maxLen = 255,
): string {
  const base =
    stripLessonPlanScopedDeckSuffix(baseDeckName) ||
    "Quiz deck";
  const label = formatCompactDayScopeLabel(dayScope ?? "all") ?? "All Days";
  if (label === "All Days") {
    return shortenTeacherTitleSegment(`${base} LP All Days`, maxLen);
  }
  return shortenTeacherTitleSegment(`${base} LP ${label}`, maxLen);
}

function formatDeckLessonDayTitleLabel(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null;
  const label = raw.trim();
  if (/^all\s*days$/i.test(label)) return "Lesson Plan All Days";
  if (/^Day\s+\d+\b/i.test(label)) return `Lesson Plan ${label}`;
  if (/^Lesson Plan\b/i.test(label)) return label;
  return `Lesson Plan ${label}`;
}

/** Pull `Lesson Plan Day N` / `Lesson Plan All Days` out of a homework title/label. */
export function extractLessonPlanDayLabelFromText(
  text: string | null | undefined,
): string | null {
  if (!text?.trim()) return null;
  const allDays = /Lesson Plan All Days|\bAll Days\b/i.exec(text);
  if (allDays) return "Lesson Plan All Days";
  const day = /Lesson Plan Day\s+(\d+)\b|\bDay\s+(\d+)\b/i.exec(text);
  if (day) return `Lesson Plan Day ${day[1] ?? day[2]}`;
  return null;
}

function stripLessonPlanDayFromText(text: string): string {
  return text
    .replace(/\s*[·\-–—]?\s*Lesson Plan All Days\b/gi, "")
    .replace(/\s*[·\-–—]?\s*Lesson Plan Day\s+\d+\b/gi, "")
    .replace(/\s*[·\-–—]?\s*\bAll Days\b/gi, "")
    .replace(/\s*[·\-–—]?\s*\bDay\s+\d+\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s*[·\-–—]\s*$/g, "")
    .trim();
}

/**
 * Short Preview heading for study guides:
 * `Algebra 1 · HW: Algebra Practice · Lesson Plan Day 2`
 */
export function formatStudyGuidePreviewSourceTitle(input: {
  lessonPlanTitle?: string | null;
  homeworkLabel?: string | null;
  homeworkAssignmentTitle?: string | null;
  /** Used when homework does not already encode a day (e.g. All Days). */
  fallbackDayLabel?: string | null;
}): string | null {
  const parts: string[] = [];

  const planTitle = input.lessonPlanTitle?.trim();
  if (planTitle) {
    parts.push(shortenTeacherTitleSegment(planTitle, 36));
  }

  const homeworkRaw =
    input.homeworkLabel?.trim() || input.homeworkAssignmentTitle?.trim() || "";
  const homeworkDay = extractLessonPlanDayLabelFromText(
    `${input.homeworkLabel ?? ""} ${input.homeworkAssignmentTitle ?? ""}`,
  );
  if (homeworkRaw) {
    const shortHw = shortenTeacherTitleSegment(
      stripLessonPlanDayFromText(homeworkRaw) || homeworkRaw,
      28,
    );
    if (shortHw) parts.push(`HW: ${shortHw}`);
  }

  const day =
    homeworkDay ??
    formatDeckLessonDayTitleLabel(input.fallbackDayLabel) ??
    null;
  if (day) parts.push(day);

  if (parts.length === 0) return null;
  return shortenTeacherTitleSegment(parts.join(" · "), 96);
}

/**
 * Compact Select label for homework pickers (study guide, etc.).
 * Prefer the saved label; omit a redundant parenthetical assignment title.
 */
export function formatHomeworkPickerOptionLabel(homework: {
  label: string;
  assignmentTitle: string;
}, maxLen = 64): string {
  const label = homework.label.trim().replace(/\s+/g, " ");
  const title = homework.assignmentTitle.trim().replace(/\s+/g, " ");
  if (!label) return shortenTeacherTitleSegment(title || "Homework", maxLen);
  if (!title) return shortenTeacherTitleSegment(label, maxLen);

  const labelKey = label.toLowerCase();
  const titleKey = title.toLowerCase();
  const titleStem = titleKey.split(/\s·\s/)[0]?.trim() ?? titleKey;
  const redundant =
    labelKey === titleKey ||
    labelKey.startsWith(titleStem) ||
    titleKey.startsWith(labelKey.split(/\s·\s/)[0]?.trim() ?? labelKey);

  if (redundant) return shortenTeacherTitleSegment(label, maxLen);
  return shortenTeacherTitleSegment(`${label} · ${title}`, maxLen);
}

/**
 * Compact source suffix for homework / study-guide / worksheet titles:
 * - Lesson plan → `Lesson Plan Day 3` (or All Days)
 * - Deck → `Deck (Short name) from Lesson Plan Day 3` when day-scoped,
 *   otherwise `Deck (Short name)`
 */
export function buildGenerationTitleSourceSuffix(input: {
  sourceType?: "lesson_plan" | "deck" | "topic" | string | null;
  dayScope?: LessonPlanDayScope | null;
  deckName?: string | null;
  /** Day/All Days parsed from a source deck description or name. */
  deckLessonScopeLabel?: string | null;
}): string {
  const sourceType = input.sourceType ?? null;

  if (sourceType === "lesson_plan") {
    return formatLessonPlanDayScopeTitleLabel(input.dayScope ?? "all") ?? "";
  }

  if (sourceType === "deck") {
    const shortDeck = input.deckName?.trim()
      ? shortenTeacherTitleSegment(formatDeckCardDisplayName(input.deckName), 28)
      : "";
    const dayLabel = formatDeckLessonDayTitleLabel(input.deckLessonScopeLabel);
    if (shortDeck && dayLabel) {
      return `Deck (${shortDeck}) from ${dayLabel}`;
    }
    if (shortDeck) return `Deck (${shortDeck})`;
    return dayLabel ?? "";
  }

  if (input.dayScope != null) {
    return formatLessonPlanDayScopeTitleLabel(input.dayScope) ?? "";
  }

  return "";
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
