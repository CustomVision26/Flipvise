import {
  normalizeOfflineInterfaceId,
  offlineAppearancePrefsFromSelection,
  offlinePaletteSnapshot,
  type OfflineInterfaceId,
} from "../../src/lib/offline/offline-appearance-palettes";
import {
  getOfflineThemePrefs,
  setOfflineThemePrefs,
} from "../../src/lib/offline/session";

function clearInlineThemeVars(root: HTMLElement): void {
  for (const name of [
    "--bg",
    "--fg",
    "--panel",
    "--panel-2",
    "--border",
    "--muted",
    "--accent",
    "--accent-2",
    "--accent-fg",
    "--accent-soft",
  ]) {
    root.style.removeProperty(name);
  }
}

function applyStoredColors(
  root: HTMLElement,
  prefs: {
    background: string | null;
    foreground: string | null;
    card: string | null;
    border: string | null;
    mutedForeground: string | null;
    primary: string | null;
    primaryForeground: string | null;
  },
): void {
  const setVar = (name: string, value: string | null) => {
    if (value) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  };

  setVar("--bg", prefs.background);
  setVar("--fg", prefs.foreground);
  setVar("--panel", prefs.card);
  setVar("--border", prefs.border);
  setVar("--muted", prefs.mutedForeground);
  setVar("--accent", prefs.primary);
  setVar("--accent-2", prefs.primary);
  setVar("--accent-fg", prefs.primaryForeground);
  if (prefs.primary) {
    root.style.setProperty(
      "--accent-soft",
      `color-mix(in oklab, ${prefs.primary} 18%, transparent)`,
    );
  } else {
    root.style.removeProperty("--accent-soft");
  }
}

/**
 * Applies the theme snapshot captured from the live dashboard (light/dark mode +
 * interface accent/background colors) to the bundled offline shell.
 *
 * Mode is reflected via `data-theme` on the root element (see `styles.css`), and
 * the captured colors are layered on as inline CSS variables so the offline UI
 * matches the user's online interface. Falls back to the default dark theme when
 * no snapshot exists.
 */
export async function applyOfflineTheme(): Promise<void> {
  const root = document.documentElement;
  const prefs = await getOfflineThemePrefs().catch(() => null);

  if (!prefs) {
    root.dataset.theme = "dark";
    delete root.dataset.uiTheme;
    clearInlineThemeVars(root);
    return;
  }

  root.dataset.theme = prefs.mode;
  const interfaceId = normalizeOfflineInterfaceId(prefs.interfaceId);

  if (interfaceId !== "neutral") {
    root.dataset.uiTheme = interfaceId;
    const palette = offlinePaletteSnapshot(prefs.mode, interfaceId);
    if (palette) {
      applyStoredColors(root, palette);
      return;
    }
  } else {
    delete root.dataset.uiTheme;
  }

  if (prefs.background || prefs.primary) {
    applyStoredColors(root, prefs);
    return;
  }

  clearInlineThemeVars(root);
}

/** Persists and immediately applies offline appearance (works fully offline). */
export async function persistOfflineAppearance(
  mode: "light" | "dark",
  interfaceId: OfflineInterfaceId,
): Promise<void> {
  await setOfflineThemePrefs(offlineAppearancePrefsFromSelection(mode, interfaceId));
  await applyOfflineTheme();
}
