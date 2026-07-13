"use client";

import * as React from "react";
import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { unwrapNativeSignInRetryUrl } from "@/lib/native-live-navigation";
import { isFlipviseNativeShell } from "@/lib/offline/is-flipvise-native-app";

/**
 * Persists a native-app marker (Capacitor Preferences) when the live site loads
 * inside the Flipvise WebView, so offline features work after navigation from
 * the bundled offline shell.
 */
export function NativeAppBootstrap() {
  const pathname = usePathname();
  const { userId, isSignedIn } = useAuth();
  const syncTokenEnsuredRef = React.useRef(false);

  React.useEffect(() => {
    const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor;

    if (!isFlipviseNativeShell()) {
      // Older builds treated any `window.Capacitor` stub (present in the web bundle) as
      // native and set these flags — clear them so PWA/browser tabs never show native UI.
      delete document.documentElement.dataset.flipviseNativeShell;
      delete document.documentElement.dataset.nativeShell;
      delete document.documentElement.dataset.platform;
      return;
    }

    document.documentElement.dataset.flipviseNativeShell = "1";
    document.documentElement.dataset.nativeShell = "1";

    try {
      const getPlatform = (
        cap as { getPlatform?: () => string } | undefined
      )?.getPlatform;
      const platform = getPlatform?.();
      if (platform) {
        document.documentElement.dataset.platform = platform;
      } else if (/Android/i.test(navigator.userAgent)) {
        document.documentElement.dataset.platform = "android";
      } else if (
        /\b(iPhone|iPad|iPod)\b/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
      ) {
        document.documentElement.dataset.platform = "ios";
      }
    } catch {
      // ignore
    }

    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      const content =
        viewportMeta.getAttribute("content") ?? "width=device-width, initial-scale=1";
      if (!content.includes("viewport-fit=cover")) {
        viewportMeta.setAttribute("content", `${content}, viewport-fit=cover`);
      }
    }

    // Prevent live-site UI from drawing under the system status / signal bar.
    void import("@capacitor/status-bar")
      .then(async ({ StatusBar, Style }) => {
        try {
          await StatusBar.setOverlaysWebView({ overlay: false });
          document.documentElement.dataset.flipviseStatusOverlay = "0";
          const dark =
            document.documentElement.classList.contains("dark") ||
            !document.documentElement.classList.contains("light");
          await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
        } catch {
          // Plugin may be unavailable on web or older native builds.
        }
      })
      .catch(() => {});

    void import("@/lib/offline/session")
      .then(async (s) => {
        await s.setNativeAppFlag();
        try {
          await s.setLastNavigationUrl(
            unwrapNativeSignInRetryUrl(window.location.href),
          );
        } catch {
          // Non-fatal — error.html falls back to dashboard handoff.
        }
        try {
          const root = document.documentElement;
          const cs = getComputedStyle(root);
          const read = (name: string) => cs.getPropertyValue(name).trim() || null;
          const uiTheme = root.dataset.uiTheme?.trim();
          await s.setOfflineThemePrefs({
            mode: root.classList.contains("light") ? "light" : "dark",
            interfaceId: uiTheme && uiTheme !== "neutral" ? uiTheme : null,
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

  // Persist Clerk user id for the offline shell on any authenticated native page.
  React.useEffect(() => {
    if (!isFlipviseNativeShell() || !isSignedIn || !userId) return;

    void import("@/lib/offline/session")
      .then(async (s) => {
        await s.setStoredUserId(userId);
        await s.setStoredApiBaseUrl(window.location.origin);
      })
      .catch(() => {});
  }, [isSignedIn, userId]);

  React.useEffect(() => {
    if (!isFlipviseNativeShell()) return;

    void import("@/lib/offline/session")
      .then((s) =>
        s.setLastNavigationUrl(unwrapNativeSignInRetryUrl(window.location.href)),
      )
      .catch(() => {});

    if (!pathname?.startsWith("/dashboard")) {
      return;
    }

    if (!isFlipviseNativeShell()) {
      return;
    }

    void import("@/lib/offline/session").then(async (session) => {
      // Keep the offline shell's user id in sync whenever the live dashboard loads
      // (not only after "Make available offline") so a cold start can load SQLite rows.
      if (isSignedIn && userId) {
        await session.setStoredUserId(userId).catch(() => {});
        await session.setStoredApiBaseUrl(window.location.origin).catch(() => {});
      }

      await session.markLastLiveDashboardVisit().catch(() => {});

      if (syncTokenEnsuredRef.current) return;
      syncTokenEnsuredRef.current = true;

      const existing = await session.getStoredSyncToken().catch(() => null);
      if (existing) return;
      try {
        const res = await fetch("/api/native/ensure-sync-token", {
          method: "POST",
          credentials: "include",
          headers: { "X-Flipvise-Native-Shell": "1" },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { token?: string };
        if (!data.token) return;
        await session.setStoredSyncToken(data.token);
        await session.setStoredApiBaseUrl(window.location.origin);
        await session.setRequireManualSignIn(false);
      } catch {
        // Non-fatal — user can still sign in manually or use Make available offline.
      }
    });
  }, [pathname, isSignedIn, userId]);

  return null;
}
