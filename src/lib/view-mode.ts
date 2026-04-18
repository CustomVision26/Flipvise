import { z } from "zod";

export const VIEW_MODES = ["grid", "list", "compact"] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export const DECKS_VIEW_COOKIE = "decks_view_mode";
export const CARDS_VIEW_COOKIE = "cards_view_mode";

export const VIEW_SCOPES = ["decks", "cards"] as const;
export type ViewScope = (typeof VIEW_SCOPES)[number];

export const setViewModeSchema = z.object({
  scope: z.enum(VIEW_SCOPES),
  view: z.enum(VIEW_MODES),
});

export type SetViewModeInput = z.infer<typeof setViewModeSchema>;

export function isViewMode(value: string | undefined): value is ViewMode {
  return !!value && (VIEW_MODES as readonly string[]).includes(value);
}

export function resolveViewMode(cookieValue: string | undefined): ViewMode {
  return isViewMode(cookieValue) ? cookieValue : "grid";
}

export function viewCookieName(scope: ViewScope): string {
  return scope === "decks" ? DECKS_VIEW_COOKIE : CARDS_VIEW_COOKIE;
}
