/**
 * Pure illustrated-appearance rules. UI and server actions share these
 * so a global switch never overwrites a saved user preference.
 */

export const ILLUSTRATED_DESIGN_AUDIT_ACTION = "illustrated_design_enabled";

export const APPEARANCE_POLL_MS = 60_000;

export const APPEARANCE_CACHE_PREFIX = "flipvise-appearance:";

export type SubjectKey =
  | "history"
  | "science"
  | "mathematics"
  | "english"
  | "geography"
  | "technology"
  | "general";

export type ArtworkSource = "cover" | "subject" | "keyword" | "general";

export type AppearanceFlags = {
  globalEnabled: boolean;
  userPreferred: boolean;
  userReduceAnimations: boolean;
  /** False on the Free plan and when the plan is unknown. */
  planAllowsIllustrated: boolean;
};

export type PublicAppearanceSnapshot = AppearanceFlags & {
  userId: string | null;
};

export const STANDARD_APPEARANCE: AppearanceFlags = {
  globalEnabled: false,
  userPreferred: false,
  userReduceAnimations: false,
  planAllowsIllustrated: false,
};

/** Cartoon style is for every plan except Free. A missing plan stays on the standard design. */
export function planAllowsIllustratedDesign(
  planSlug: string | null | undefined,
): boolean {
  const slug = planSlug?.trim().toLowerCase();
  return Boolean(slug) && slug !== "free";
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

export function coalesceUserAppearance(
  row: {
    illustratedDesignPreferred?: boolean | null;
    reduceAnimations?: boolean | null;
  } | null
  | undefined,
): { illustratedDesignPreferred: boolean; reduceAnimations: boolean } {
  return {
    illustratedDesignPreferred: row?.illustratedDesignPreferred === true,
    reduceAnimations: row?.reduceAnimations === true,
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
