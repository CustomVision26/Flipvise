/**
 * Pure illustrated-appearance rules. UI and server actions share these
 * so a global switch never overwrites a saved user preference.
 */

export const ILLUSTRATED_DESIGN_AUDIT_ACTION = "illustrated_design_enabled";

export const APPEARANCE_POLL_MS = 60_000;

export const APPEARANCE_CACHE_PREFIX = "flipvise-appearance:";

/** Shortest time the current background scene stays up. */
export const BACKGROUND_CHANGE_HOURS_MIN = 2;

/** Longest time the current background scene stays up. */
export const BACKGROUND_CHANGE_HOURS_MAX = 24;

export const DEFAULT_BACKGROUND_CHANGE_HOURS = 24;

export type SubjectKey =
  | "history"
  | "science"
  | "mathematics"
  | "english"
  | "geography"
  | "technology"
  | "general";

export type ArtworkSource = "cover" | "subject" | "keyword" | "general";

/** Scenes the background walks through after the current one. */
export const BACKGROUND_SCENE_ORDER: SubjectKey[] = [
  "general",
  "mathematics",
  "science",
  "history",
  "english",
  "geography",
  "technology",
];

export type AppearanceFlags = {
  globalEnabled: boolean;
  userPreferred: boolean;
  userReduceAnimations: boolean;
  /** True on every plan, including Free. False only for a signed-out snapshot. */
  planAllowsIllustrated: boolean;
  /** When true, woodland background scenes advance on the saved hour interval. */
  backgroundChangeEnabled: boolean;
  /** Whole hours from 2 through 24. */
  backgroundChangeHours: number;
  /** ISO time the current interval started. Null keeps the current scene. */
  backgroundRotationStartedAt: string | null;
};

export type PublicAppearanceSnapshot = AppearanceFlags & {
  userId: string | null;
};

export const STANDARD_APPEARANCE: AppearanceFlags = {
  globalEnabled: false,
  userPreferred: false,
  userReduceAnimations: false,
  planAllowsIllustrated: false,
  backgroundChangeEnabled: true,
  backgroundChangeHours: DEFAULT_BACKGROUND_CHANGE_HOURS,
  backgroundRotationStartedAt: null,
};

/** Cartoon artwork, backgrounds, and layered cards are included on every plan, including Free. */
export function planAllowsIllustratedDesign(
  _planSlug?: string | null,
): boolean {
  return true;
}

export function resolveEffectiveIllustratedDesign(
  globalEnabled: boolean,
  userPreferred: boolean,
  planAllowsIllustrated: boolean,
): boolean {
  return (
    globalEnabled === true &&
    userPreferred === true &&
    planAllowsIllustrated === true
  );
}

export function resolveEffectiveReducedMotion(
  userReduceAnimations: boolean,
  systemPrefersReducedMotion: boolean,
): boolean {
  return userReduceAnimations === true || systemPrefersReducedMotion === true;
}

/** Re-enabling the master switch restores the stored user choice. It does not rewrite it. */
export function appearanceAfterGlobalChange(input: {
  userPreferred: boolean;
  nextGlobalEnabled: boolean;
  planAllowsIllustrated: boolean;
}): { userPreferred: boolean; effectiveIllustratedDesign: boolean } {
  return {
    userPreferred: input.userPreferred,
    effectiveIllustratedDesign: resolveEffectiveIllustratedDesign(
      input.nextGlobalEnabled,
      input.userPreferred,
      input.planAllowsIllustrated,
    ),
  };
}

export function clampBackgroundChangeHours(value: number | null | undefined): number {
  const rounded = Math.round(Number(value));
  if (!Number.isFinite(rounded)) return DEFAULT_BACKGROUND_CHANGE_HOURS;
  return Math.min(
    BACKGROUND_CHANGE_HOURS_MAX,
    Math.max(BACKGROUND_CHANGE_HOURS_MIN, rounded),
  );
}

/**
 * How many scenes to advance from the one on screen.
 * The first interval after `startedAtMs` stays on scene 0.
 */
export function backgroundSceneStep(input: {
  nowMs: number | null;
  startedAtMs: number | null;
  hours: number;
  enabled: boolean;
  sceneCount?: number;
}): number {
  if (
    !input.enabled ||
    input.nowMs == null ||
    !Number.isFinite(input.nowMs) ||
    input.startedAtMs == null ||
    !Number.isFinite(input.startedAtMs)
  ) {
    return 0;
  }
  const count = Math.max(1, input.sceneCount ?? BACKGROUND_SCENE_ORDER.length);
  const interval = clampBackgroundChangeHours(input.hours) * 60 * 60 * 1000;
  const elapsed = input.nowMs - input.startedAtMs;
  if (!Number.isFinite(elapsed) || elapsed < interval) return 0;
  const steps = Math.floor(elapsed / interval);
  return ((steps % count) + count) % count;
}

export function nextBackgroundSubject(base: SubjectKey, step: number): SubjectKey {
  if (step <= 0) return base;
  const order = BACKGROUND_SCENE_ORDER;
  const start = Math.max(0, order.indexOf(base));
  return order[(start + step) % order.length] ?? base;
}

function rotationStartedAtIso(value: Date | string | null | undefined): string | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function coalesceUserAppearance(
  row: {
    illustratedDesignPreferred?: boolean | null;
    reduceAnimations?: boolean | null;
    backgroundChangeEnabled?: boolean | null;
    backgroundChangeHours?: number | null;
    backgroundRotationStartedAt?: Date | string | null;
  } | null
  | undefined,
): {
  illustratedDesignPreferred: boolean;
  reduceAnimations: boolean;
  backgroundChangeEnabled: boolean;
  backgroundChangeHours: number;
  backgroundRotationStartedAt: string | null;
} {
  return {
    illustratedDesignPreferred: row?.illustratedDesignPreferred === true,
    reduceAnimations: row?.reduceAnimations === true,
    backgroundChangeEnabled: row?.backgroundChangeEnabled !== false,
    backgroundChangeHours: clampBackgroundChangeHours(row?.backgroundChangeHours),
    backgroundRotationStartedAt: rotationStartedAtIso(row?.backgroundRotationStartedAt),
  };
}

export function coalesceGlobalAppearance(
  row: { illustratedDesignEnabled?: boolean | null } | null | undefined,
): boolean {
  return row?.illustratedDesignEnabled === true;
}

/** A failed settings read keeps the last good snapshot, or the standard design. */
export function appearanceAfterReadFailure(
  previous: PublicAppearanceSnapshot | null | undefined,
  userId: string | null,
): PublicAppearanceSnapshot {
  if (previous && previous.userId === userId) return previous;
  return { userId, ...STANDARD_APPEARANCE };
}

/** Ignore a response that belongs to a different signed-in account. */
export function shouldApplyAppearanceSnapshot(
  currentUserId: string | null,
  incomingUserId: string | null,
): boolean {
  return currentUserId === incomingUserId;
}

export function canUpdateGlobalAppearance(isAdmin: boolean): boolean {
  return isAdmin === true;
}

export function canUpdateUserAppearance(
  sessionUserId: string | null | undefined,
  targetUserId: string,
): boolean {
  return (
    typeof sessionUserId === "string" &&
    sessionUserId.length > 0 &&
    sessionUserId === targetUserId
  );
}

export function appearanceCacheKey(userId: string): string {
  return `${APPEARANCE_CACHE_PREFIX}${userId}`;
}

const SUBJECT_KEYWORDS: { subject: SubjectKey; words: string[] }[] = [
  {
    subject: "history",
    words: [
      "history",
      "social studies",
      "social study",
      "revolution",
      "empire",
      "ancient",
      "war",
      "magna",
      "union",
      "queen",
      "king",
      "civilization",
    ],
  },
  {
    subject: "science",
    words: [
      "science",
      "biology",
      "chemistry",
      "physics",
      "environment",
      "pollution",
      "climate",
      "atom",
      "ecosystem",
      "lab",
    ],
  },
  {
    subject: "mathematics",
    words: [
      "math",
      "maths",
      "algebra",
      "geometry",
      "calculus",
      "arithmetic",
      "equation",
      "fraction",
      "addition",
      "multiplication",
      "multiply",
      "statistics",
      "statistic",
      "probability",
    ],
  },
  {
    subject: "english",
    words: [
      "english",
      "language",
      "literature",
      "grammar",
      "writing",
      "reading",
      "languages",
      "vocabulary",
      "essay",
      "poetry",
      "tense",
      "tenses",
      "spelling",
      "scramble",
      "meaning",
      "meanings",
    ],
  },
  {
    subject: "geography",
    words: [
      "geography",
      "map",
      "maps",
      "town",
      "towns",
      "weather",
      "landscape",
      "landscapes",
      "continent",
      "country",
      "capital",
      "ocean",
      "river",
      "rivers",
      "mountain",
      "mountains",
      "earth",
      "tectonic",
      "tectonics",
      "earthquake",
      "earthquakes",
    ],
  },
  {
    subject: "technology",
    words: [
      "technology",
      "computer",
      "coding",
      "software",
      "programming",
      "engineering",
      "robot",
      "digital",
      "mechanic",
      "mechanics",
    ],
  },
];

const SUBJECT_LABELS: Record<string, SubjectKey> = {
  history: "history",
  "social studies": "history",
  "social study": "history",
  science: "science",
  environment: "science",
  "environmental science": "science",
  math: "mathematics",
  maths: "mathematics",
  mathematics: "mathematics",
  algebra: "mathematics",
  english: "english",
  language: "english",
  "language arts": "english",
  literature: "english",
  geography: "geography",
  technology: "technology",
  computing: "technology",
  "computer science": "technology",
  general: "general",
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hasPhrase(haystack: string, phrase: string): boolean {
  return ` ${haystack} `.includes(` ${normalize(phrase)} `);
}

export function subjectFromExplicitLabel(
  subject: string | null | undefined,
): SubjectKey | null {
  if (!subject?.trim()) return null;
  const key = normalize(subject);
  return SUBJECT_LABELS[key] ?? null;
}

export function subjectFromKeywords(
  text: string | null | undefined,
): SubjectKey | null {
  if (!text?.trim()) return null;
  const haystack = normalize(text);
  for (const entry of SUBJECT_KEYWORDS) {
    if (entry.words.some((word) => hasPhrase(haystack, word))) {
      return entry.subject;
    }
  }
  return null;
}

export function resolveSubjectArtwork(input: {
  name?: string | null;
  description?: string | null;
  gradeLevel?: string | null;
  coverImageUrl?: string | null;
  /** Explicit subject label when the caller already has one. Not written back to the deck. */
  subject?: string | null;
}): { subject: SubjectKey; source: ArtworkSource; coverImageUrl: string | null } {
  const cover = input.coverImageUrl?.trim() || null;
  if (cover) {
    const labeled =
      subjectFromExplicitLabel(input.subject) ??
      subjectFromKeywords(
        [input.subject, input.name, input.description, input.gradeLevel]
          .filter(Boolean)
          .join(" "),
      );
    return {
      subject: labeled ?? "general",
      source: "cover",
      coverImageUrl: cover,
    };
  }

  const explicit = subjectFromExplicitLabel(input.subject);
  if (explicit) {
    return { subject: explicit, source: "subject", coverImageUrl: null };
  }

  const keyword = subjectFromKeywords(
    [input.name, input.description, input.gradeLevel].filter(Boolean).join(" "),
  );
  if (keyword) {
    return { subject: keyword, source: "keyword", coverImageUrl: null };
  }

  return { subject: "general", source: "general", coverImageUrl: null };
}

export const SUBJECT_PALETTES: Record<
  SubjectKey,
  { from: string; to: string; accent: string; label: string }
> = {
  history: {
    from: "#6d28d9",
    to: "#f5c16c",
    accent: "#7c3aed",
    label: "History and social studies",
  },
  science: {
    from: "#0f766e",
    to: "#38bdf8",
    accent: "#14b8a6",
    label: "Science and environment",
  },
  mathematics: {
    from: "#ea580c",
    to: "#fb7185",
    accent: "#f97316",
    label: "Mathematics",
  },
  english: {
    from: "#4338ca",
    to: "#c4b5fd",
    accent: "#6366f1",
    label: "English and languages",
  },
  geography: {
    from: "#15803d",
    to: "#22d3ee",
    accent: "#16a34a",
    label: "Geography",
  },
  technology: {
    from: "#1d4ed8",
    to: "#67e8f9",
    accent: "#2563eb",
    label: "Technology",
  },
  general: {
    from: "#5b21b6",
    to: "#22d3ee",
    accent: "#7c3aed",
    label: "General learning",
  },
};
