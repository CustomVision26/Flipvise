import { z } from "zod";

/** Cookie storing Pro users’ UI base color (shadcn-style names; light + dark in `globals.css`). */
export const PRO_UI_THEME_COOKIE = "pro_ui_theme";

/** Pro (personal) tier: first N presets from {@link PRO_UI_THEME_OPTIONS}. */
export const PRO_INTERFACE_BACKGROUND_COLOR_COUNT = 8;

/** Pro Plus (and team / admin): full preset list length. */
export const PRO_PLUS_INTERFACE_BACKGROUND_COLOR_COUNT = 12;

/**
 * Base color presets aligned with shadcn registry names (dark theme tints).
 * `neutral` restores the default app palette (cookie cleared).
 * Order matters: the first {@link PRO_INTERFACE_BACKGROUND_COLOR_COUNT} entries are the Pro tier subset; the full list is Pro Plus.
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

export function proUiThemeOptionsForTier(
  hasProPlusInterfacePalette: boolean,
): readonly (typeof PRO_UI_THEME_OPTIONS)[number][] {
  if (hasProPlusInterfacePalette) return PRO_UI_THEME_OPTIONS;
  return PRO_UI_THEME_OPTIONS.slice(0, PRO_INTERFACE_BACKGROUND_COLOR_COUNT);
}

export function isProUiThemeAllowedForTier(
  theme: ProUiThemeId,
  hasProPlusInterfacePalette: boolean,
): boolean {
  return proUiThemeOptionsForTier(hasProPlusInterfacePalette).some((o) => o.id === theme);
}

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
  hasProPlusInterfacePalette: boolean,
): string | undefined {
  if (!isPro || !cookieValue || !isProUiThemeId(cookieValue) || cookieValue === "neutral") {
    return undefined;
  }
  if (!isProUiThemeAllowedForTier(cookieValue, hasProPlusInterfacePalette)) {
    return undefined;
  }
  return cookieValue;
}

/** Current selection for the dropdown (includes neutral). */
export function resolveProUiThemeSelection(
  cookieValue: string | undefined,
  hasProPlusInterfacePalette: boolean,
): ProUiThemeId {
  if (cookieValue && isProUiThemeId(cookieValue)) {
    if (isProUiThemeAllowedForTier(cookieValue, hasProPlusInterfacePalette)) {
      return cookieValue;
    }
  }
  return "neutral";
}
