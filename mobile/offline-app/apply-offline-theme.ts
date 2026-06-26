import { getOfflineThemePrefs } from "../../src/lib/offline/session";

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
    return;
  }

  root.dataset.theme = prefs.mode;

  const setVar = (name: string, value: string | null) => {
    if (value) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  };

  // Interface tint — page background + core surfaces/text.
  setVar("--bg", prefs.background);
  setVar("--fg", prefs.foreground);
  setVar("--panel", prefs.card);
  setVar("--border", prefs.border);
  setVar("--muted", prefs.mutedForeground);

  // Interface accent — buttons, active states, progress, brand mark.
  setVar("--accent", prefs.primary);
  setVar("--accent-2", prefs.primary);
  setVar("--accent-fg", prefs.primaryForeground);
  if (prefs.primary) {
    root.style.setProperty(
      "--accent-soft",
      `color-mix(in oklab, ${prefs.primary} 18%, transparent)`,
    );
  }
}
