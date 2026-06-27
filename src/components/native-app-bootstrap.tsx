"use client";

import * as React from "react";
import { isFlipviseNativeApp } from "@/lib/offline/is-flipvise-native-app";

/**
 * Persists a native-app marker (Capacitor Preferences) when the live site loads
 * inside the Flipvise WebView, so offline features work after navigation from
 * the bundled offline shell.
 */
export function NativeAppBootstrap() {
  React.useEffect(() => {
    const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor;
    const likelyNative =
      isFlipviseNativeApp() ||
      Boolean(cap?.isNativePlatform?.()) ||
      Boolean(cap);

    if (!likelyNative) return;

    document.documentElement.dataset.flipviseNativeShell = "1";
    document.documentElement.dataset.nativeShell = "1";

    try {
      const getPlatform = (
        cap as { getPlatform?: () => string } | undefined
      )?.getPlatform;
      const platform = getPlatform?.();
      if (platform) {
        document.documentElement.dataset.platform = platform;
      }
    } catch {
      // ignore
    }

    // Live Render pages need viewport-fit=cover so env(safe-area-inset-*) clears the
    // iOS status bar for the app header (workspace switcher, notifications, etc.).
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      const content =
        viewportMeta.getAttribute("content") ?? "width=device-width, initial-scale=1";
      if (!content.includes("viewport-fit=cover")) {
        viewportMeta.setAttribute("content", `${content}, viewport-fit=cover`);
      }
    }

    void import("@/lib/offline/session")
      .then(async (s) => {
        await s.setNativeAppFlag();
        // Snapshot the dashboard's resolved theme (mode + interface colors) so the
        // bundled offline shell can match it. `<html>` here carries both the
        // light/dark class and `data-ui-theme`, so computed values are accurate.
        try {
          const root = document.documentElement;
          const cs = getComputedStyle(root);
          const read = (name: string) => cs.getPropertyValue(name).trim() || null;
          await s.setOfflineThemePrefs({
            mode: root.classList.contains("light") ? "light" : "dark",
            background: read("--background"),
            foreground: read("--foreground"),
            card: read("--card"),
            border: read("--border"),
            mutedForeground: read("--muted-foreground"),
            primary: read("--primary"),
            primaryForeground: read("--primary-foreground"),
          });
        } catch {
          // Non-fatal: offline shell falls back to its default dark theme.
        }
      })
      .catch(() => {});
  }, []);

  return null;
}
