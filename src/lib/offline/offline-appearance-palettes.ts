import {
  PRO_UI_THEME_OPTIONS,
  proUiThemeOptionsForTier,
  type ProUiThemeId,
} from "@/lib/pro-ui-theme";
import { FREE_UI_THEME_OPTIONS } from "@/lib/free-ui-theme";
import type { OfflineThemePrefs } from "@/lib/offline/session";

export type OfflineInterfaceId = ProUiThemeId;

type PaletteSnapshot = {
  background: string;
  foreground: string;
  card: string;
  border: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
};

function snap(
  background: string,
  foreground: string,
  card: string,
  border: string,
  mutedForeground: string,
  primary: string,
  primaryForeground: string,
): PaletteSnapshot {
  return {
    background,
    foreground,
    card,
    border,
    mutedForeground,
    primary,
    primaryForeground,
  };
}

const DARK_PALETTES: Record<Exclude<OfflineInterfaceId, "neutral">, PaletteSnapshot> =
  {
    stone: snap(
      "oklch(0.14 0.012 70)",
      "oklch(0.985 0.006 70)",
      "oklch(0.2 0.016 70)",
      "oklch(1 0 0 / 11%)",
      "oklch(0.72 0.03 70)",
      "oklch(0.88 0.04 70)",
      "oklch(0.18 0.02 70)",
    ),
    zinc: snap(
      "oklch(0.14 0.01 285)",
      "oklch(0.985 0.004 285)",
      "oklch(0.2 0.014 285)",
      "oklch(1 0 0 / 11%)",
      "oklch(0.72 0.025 285)",
      "oklch(0.9 0.02 285)",
      "oklch(0.18 0.02 285)",
    ),
    slate: snap(
      "oklch(0.14 0.018 260)",
      "oklch(0.985 0.008 260)",
      "oklch(0.2 0.024 260)",
      "oklch(1 0 0 / 11%)",
      "oklch(0.72 0.035 260)",
      "oklch(0.86 0.05 260)",
      "oklch(0.17 0.03 260)",
    ),
    red: snap(
      "oklch(0.14 0.03 25)",
      "oklch(0.985 0.01 25)",
      "oklch(0.2 0.04 25)",
      "oklch(1 0 0 / 11%)",
      "oklch(0.74 0.06 25)",
      "oklch(0.72 0.2 25)",
      "oklch(0.985 0.01 25)",
    ),
    rose: snap(
      "oklch(0.14 0.028 12)",
      "oklch(0.985 0.01 12)",
      "oklch(0.2 0.038 12)",
      "oklch(1 0 0 / 11%)",
      "oklch(0.74 0.055 12)",
      "oklch(0.7 0.18 12)",
      "oklch(0.985 0.01 12)",
    ),
    orange: snap(
      "oklch(0.14 0.028 55)",
      "oklch(0.985 0.012 55)",
      "oklch(0.2 0.038 55)",
      "oklch(1 0 0 / 11%)",
      "oklch(0.74 0.05 55)",
      "oklch(0.78 0.16 55)",
      "oklch(0.16 0.04 55)",
    ),
    green: snap(
      "oklch(0.14 0.028 150)",
      "oklch(0.985 0.01 150)",
      "oklch(0.2 0.038 150)",
      "oklch(1 0 0 / 11%)",
      "oklch(0.72 0.05 150)",
      "oklch(0.74 0.16 150)",
      "oklch(0.16 0.04 150)",
    ),
    blue: snap(
      "oklch(0.13 0.04 264)",
      "oklch(0.985 0.012 264)",
      "oklch(0.19 0.05 264)",
      "oklch(1 0 0 / 11%)",
      "oklch(0.72 0.06 264)",
      "oklch(0.7 0.18 264)",
      "oklch(0.985 0.012 264)",
    ),
    yellow: snap(
      "oklch(0.14 0.03 95)",
      "oklch(0.985 0.02 95)",
      "oklch(0.2 0.04 95)",
      "oklch(1 0 0 / 11%)",
      "oklch(0.74 0.05 95)",
      "oklch(0.82 0.14 95)",
      "oklch(0.18 0.04 95)",
    ),
    violet: snap(
      "oklch(0.14 0.04 290)",
      "oklch(0.985 0.012 290)",
      "oklch(0.2 0.05 290)",
      "oklch(1 0 0 / 11%)",
      "oklch(0.72 0.06 290)",
      "oklch(0.72 0.18 290)",
      "oklch(0.985 0.012 290)",
    ),
    purple: snap(
      "oklch(0.14 0.045 305)",
      "oklch(0.985 0.014 305)",
      "oklch(0.2 0.055 305)",
      "oklch(1 0 0 / 11%)",
      "oklch(0.72 0.065 305)",
      "oklch(0.7 0.19 305)",
      "oklch(0.985 0.014 305)",
    ),
  };

const LIGHT_PALETTES: Record<Exclude<OfflineInterfaceId, "neutral">, PaletteSnapshot> =
  {
    stone: snap(
      "oklch(0.985 0.008 70)",
      "oklch(0.2 0.022 70)",
      "oklch(1 0.012 70)",
      "oklch(0.9 0.02 70)",
      "oklch(0.46 0.035 70)",
      "oklch(0.38 0.065 70)",
      "oklch(0.99 0.006 70)",
    ),
    zinc: snap(
      "oklch(0.985 0.006 285)",
      "oklch(0.2 0.018 285)",
      "oklch(1 0.008 285)",
      "oklch(0.9 0.016 285)",
      "oklch(0.46 0.03 285)",
      "oklch(0.36 0.05 285)",
      "oklch(0.99 0.004 285)",
    ),
    slate: snap(
      "oklch(0.985 0.01 260)",
      "oklch(0.19 0.024 260)",
      "oklch(1 0.014 260)",
      "oklch(0.89 0.02 260)",
      "oklch(0.45 0.038 260)",
      "oklch(0.35 0.07 260)",
      "oklch(0.99 0.008 260)",
    ),
    red: snap(
      "oklch(0.985 0.012 25)",
      "oklch(0.22 0.04 25)",
      "oklch(1 0.016 25)",
      "oklch(0.9 0.025 25)",
      "oklch(0.48 0.08 25)",
      "oklch(0.52 0.2 25)",
      "oklch(0.99 0.01 25)",
    ),
    rose: snap(
      "oklch(0.985 0.014 12)",
      "oklch(0.22 0.038 12)",
      "oklch(1 0.018 12)",
      "oklch(0.9 0.024 12)",
      "oklch(0.48 0.075 12)",
      "oklch(0.5 0.18 12)",
      "oklch(0.99 0.01 12)",
    ),
    orange: snap(
      "oklch(0.985 0.014 55)",
      "oklch(0.2 0.04 55)",
      "oklch(1 0.02 55)",
      "oklch(0.9 0.028 55)",
      "oklch(0.46 0.07 55)",
      "oklch(0.55 0.16 55)",
      "oklch(0.99 0.012 55)",
    ),
    green: snap(
      "oklch(0.985 0.014 150)",
      "oklch(0.2 0.038 150)",
      "oklch(1 0.02 150)",
      "oklch(0.9 0.028 150)",
      "oklch(0.44 0.07 150)",
      "oklch(0.48 0.14 150)",
      "oklch(0.99 0.01 150)",
    ),
    blue: snap(
      "oklch(0.985 0.016 264)",
      "oklch(0.2 0.045 264)",
      "oklch(1 0.022 264)",
      "oklch(0.89 0.03 264)",
      "oklch(0.44 0.08 264)",
      "oklch(0.48 0.16 264)",
      "oklch(0.99 0.012 264)",
    ),
    yellow: snap(
      "oklch(0.99 0.02 95)",
      "oklch(0.22 0.045 95)",
      "oklch(1 0.028 95)",
      "oklch(0.91 0.035 95)",
      "oklch(0.46 0.08 95)",
      "oklch(0.58 0.14 95)",
      "oklch(0.2 0.05 95)",
    ),
    violet: snap(
      "oklch(0.985 0.018 290)",
      "oklch(0.2 0.05 290)",
      "oklch(1 0.024 290)",
      "oklch(0.89 0.032 290)",
      "oklch(0.44 0.085 290)",
      "oklch(0.5 0.17 290)",
      "oklch(0.99 0.012 290)",
    ),
    purple: snap(
      "oklch(0.985 0.02 305)",
      "oklch(0.2 0.055 305)",
      "oklch(1 0.028 305)",
      "oklch(0.89 0.035 305)",
      "oklch(0.44 0.09 305)",
      "oklch(0.48 0.18 305)",
      "oklch(0.99 0.014 305)",
    ),
  };

/** Swatch fill for the interface color picker (uses the theme primary). */
export function offlineInterfaceSwatchColor(
  mode: "light" | "dark",
  id: OfflineInterfaceId,
): string {
  if (id === "neutral") {
    return mode === "light" ? "#71717a" : "#3f3f46";
  }
  const palette = mode === "light" ? LIGHT_PALETTES[id] : DARK_PALETTES[id];
  return palette.primary;
}

export function offlinePaletteSnapshot(
  mode: "light" | "dark",
  id: OfflineInterfaceId,
): PaletteSnapshot | null {
  if (id === "neutral") return null;
  const table = mode === "light" ? LIGHT_PALETTES : DARK_PALETTES;
  return table[id] ?? null;
}

export function offlineInterfaceOptions(
  isPro: boolean,
  hasProPlusInterfacePalette: boolean,
): readonly { id: OfflineInterfaceId; label: string }[] {
  if (!isPro) {
    return FREE_UI_THEME_OPTIONS.map((o) => ({
      id: o.id as OfflineInterfaceId,
      label: o.label,
    }));
  }
  return proUiThemeOptionsForTier(hasProPlusInterfacePalette);
}

export function normalizeOfflineInterfaceId(
  value: string | null | undefined,
): OfflineInterfaceId {
  if (value && PRO_UI_THEME_OPTIONS.some((o) => o.id === value)) {
    return value as OfflineInterfaceId;
  }
  return "neutral";
}

export function offlineAppearancePrefsFromSelection(
  mode: "light" | "dark",
  interfaceId: OfflineInterfaceId,
): OfflineThemePrefs {
  const snap = offlinePaletteSnapshot(mode, interfaceId);
  return {
    mode,
    interfaceId,
    background: snap?.background ?? null,
    foreground: snap?.foreground ?? null,
    card: snap?.card ?? null,
    border: snap?.border ?? null,
    mutedForeground: snap?.mutedForeground ?? null,
    primary: snap?.primary ?? null,
    primaryForeground: snap?.primaryForeground ?? null,
  };
}

export function resolveOfflineAppearanceAccess(planLabel?: string, hasTeamTier?: boolean) {
  const label = (planLabel ?? "").toLowerCase();
  const isPro =
    Boolean(hasTeamTier) ||
    label.includes("pro") ||
    label.includes("team") ||
    label.includes("platinum") ||
    label.includes("enterprise");
  const hasProPlusInterfacePalette =
    Boolean(hasTeamTier) ||
    label.includes("plus") ||
    label.includes("team") ||
    label.includes("platinum") ||
    label.includes("enterprise");
  return { isPro, hasProPlusInterfacePalette };
}
