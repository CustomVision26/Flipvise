import { z } from "zod";

/** Cookie storing Free users' UI base color selection. */
export const FREE_UI_THEME_COOKIE = "free_ui_theme";

/**
 * Base color presets for free users (limited to 3 options).
 * `neutral` is the default app palette.
 */
export const FREE_UI_THEME_OPTIONS = [
  { id: "neutral", label: "Neutral", preview: "bg-gradient-to-br from-slate-600 to-slate-800" },
  { id: "blue", label: "Blue", preview: "bg-gradient-to-br from-blue-500 to-blue-700" },
  { id: "violet", label: "Violet", preview: "bg-gradient-to-br from-violet-500 to-violet-700" },
] as const;

export type FreeUiThemeId = (typeof FREE_UI_THEME_OPTIONS)[number]["id"];

export const setFreeUiThemeSchema = z.object({
  theme: z
    .string()
    .refine((v): v is FreeUiThemeId => FREE_UI_THEME_OPTIONS.some((o) => o.id === v), "Invalid theme"),
});

export type SetFreeUiThemeInput = z.infer<typeof setFreeUiThemeSchema>;

export function isFreeUiThemeId(value: string | undefined): value is FreeUiThemeId {
  return !!value && FREE_UI_THEME_OPTIONS.some((o) => o.id === value);
}

/** Theme applied to `<html data-ui-theme>` for free users — `undefined` means default neutral palette. */
export function resolveFreeUiThemeDataAttribute(
  isPro: boolean,
  cookieValue: string | undefined,
): string | undefined {
  if (isPro || !cookieValue || !isFreeUiThemeId(cookieValue) || cookieValue === "neutral") {
    return undefined;
  }
  return cookieValue;
}

/** Current selection for free users (includes neutral). */
export function resolveFreeUiThemeSelection(cookieValue: string | undefined): FreeUiThemeId {
  if (cookieValue && isFreeUiThemeId(cookieValue)) return cookieValue;
  return "neutral";
}
