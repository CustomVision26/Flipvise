/**
 * Stable add-on catalog keys. Prefer these constants over string literals
 * so future add-ons stay discoverable and typo-safe.
 */
export const AI_ESSAY_ADDON_KEY = "ai_essay" as const;

export const STUDY_MODE_FOCUS_ADDON_KEY = "study_mode_focus" as const;

/** Organization add-on — Live Classroom™ (team / education team plans only). */
export const LIVE_CLASSROOM_ADDON_KEY = "live_classroom" as const;

/**
 * Document-type add-ons housed in AI Document Studio.
 * Only keys that exist in `addon_catalog` and may be entitled today.
 * Future types (research paper, lab report, …) get catalog rows + keys here.
 */
export const AI_DOCUMENT_STUDIO_ADDON_KEYS = [AI_ESSAY_ADDON_KEY] as const;

export type AiDocumentStudioAddonKey =
  (typeof AI_DOCUMENT_STUDIO_ADDON_KEYS)[number];

export type KnownAddonKey =
  | typeof AI_ESSAY_ADDON_KEY
  | typeof STUDY_MODE_FOCUS_ADDON_KEY
  | typeof LIVE_CLASSROOM_ADDON_KEY
  | (string & {});

/** True when the key is an AI Document Studio document-type add-on. */
export function isAiDocumentStudioAddonKey(key: string): boolean {
  return (AI_DOCUMENT_STUDIO_ADDON_KEYS as readonly string[]).includes(key);
}

/** True when the user holds at least one AI Document Studio document add-on. */
export function hasAnyAiDocumentStudioAddon(
  activeAddonKeys: readonly string[],
): boolean {
  return AI_DOCUMENT_STUDIO_ADDON_KEYS.some((key) =>
    activeAddonKeys.includes(key),
  );
}
