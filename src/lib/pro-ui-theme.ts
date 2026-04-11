import { z } from "zod";

/** Cookie storing Pro users’ UI base color (shadcn-style names; light + dark in `globals.css`). */
export const PRO_UI_THEME_COOKIE = "pro_ui_theme";

/**
 * Base color presets aligned with shadcn registry names (dark theme tints).
 * `neutral` restores the default app palette (cookie cleared).
 */
export const PRO_UI_THEME_OPTIONS = [
  { id: "neutral", label: "Neutral (default)" },
  { id: "stone", label: "Stone" },
  { id: "zinc", label: "Zinc" },
  { id: "slate", label: "Slate" },
  { id: "red", label: "Red" },
  { id: "rose", label: "Rose" },
  { id: "orange", label: "Orange" },
  { id: "green", label: "Green" },
  { id: "blue", label: "Blue" },
  { id: "yellow", label: "Yellow" },
  { id: "violet", label: "Violet" },
  { id: "purple", label: "Purple" },
] as const;

export type ProUiThemeId = (typeof PRO_UI_THEME_OPTIONS)[number]["id"];

export const setProUiThemeSchema = z.object({
  theme: z
    .string()
    .refine((v): v is ProUiThemeId => PRO_UI_THEME_OPTIONS.some((o) => o.id === v), "Invalid theme"),
});

export type SetProUiThemeInput = z.infer<typeof setProUiThemeSchema>;

export function isProUiThemeId(value: string | undefined): value is ProUiThemeId {
  return !!value && PRO_UI_THEME_OPTIONS.some((o) => o.id === value);
}

/** Theme applied to `<html data-ui-theme>` — `undefined` means default neutral palette. */
export function resolveProUiThemeDataAttribute(
  isPro: boolean,
  cookieValue: string | undefined,
): string | undefined {
  if (!isPro || !cookieValue || !isProUiThemeId(cookieValue) || cookieValue === "neutral") {
    return undefined;
  }
  return cookieValue;
}

/** Current selection for the dropdown (includes neutral). */
export function resolveProUiThemeSelection(cookieValue: string | undefined): ProUiThemeId {
  if (cookieValue && isProUiThemeId(cookieValue)) return cookieValue;
  return "neutral";
}
