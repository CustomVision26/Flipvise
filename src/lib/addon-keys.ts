/**
 * Stable add-on catalog keys. Prefer these constants over string literals
 * so future add-ons stay discoverable and typo-safe.
 */
export const AI_ESSAY_ADDON_KEY = "ai_essay" as const;

export const STUDY_MODE_FOCUS_ADDON_KEY = "study_mode_focus" as const;

export type KnownAddonKey =
  | typeof AI_ESSAY_ADDON_KEY
  | typeof STUDY_MODE_FOCUS_ADDON_KEY
  | (string & {});
