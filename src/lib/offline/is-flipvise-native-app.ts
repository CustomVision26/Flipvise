"use client";

import { Capacitor } from "@capacitor/core";
import {
  FLIPVISE_NATIVE_QUERY_PARAM,
  FLIPVISE_NATIVE_UA_MARKER,
} from "@/lib/flipvise-native-constants";
import {
  FLIPVISE_OFFLINE_SHELL_ANDROID_URL,
  FLIPVISE_OFFLINE_SHELL_IOS_URL,
} from "@/lib/offline/offline-shell-url";

export { FLIPVISE_NATIVE_QUERY_PARAM, FLIPVISE_NATIVE_UA_MARKER };
export {
  FLIPVISE_OFFLINE_SHELL_ANDROID_URL,
  FLIPVISE_OFFLINE_SHELL_IOS_URL,
};

/** @deprecated Prefer {@link resolveOfflineShellUrl} — Android URL only. */
export const FLIPVISE_OFFLINE_SHELL_URL = FLIPVISE_OFFLINE_SHELL_ANDROID_URL;

/** Synchronous native-shell check — safe during first client render in Capacitor. */
export function detectNativeShellNow(): boolean {
  return isFlipviseNativeShell();
}

function isIosUserAgent(ua: string): boolean {
  return (
    /\b(iPhone|iPad|iPod)\b/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * URL of the bundled offline Study shell for the current native platform.
 * iOS must use `capacitor://localhost/...` (not `https://`) or WKWebView opens Safari.
 */
export function resolveOfflineShellUrl(): string {
  if (typeof window === "undefined") return FLIPVISE_OFFLINE_SHELL_ANDROID_URL;

  if (!isFlipviseNativeShell()) return FLIPVISE_OFFLINE_SHELL_ANDROID_URL;

  let platform: string | undefined;
  try {
    platform = Capacitor.getPlatform();
  } catch {
    platform = undefined;
  }

  if (platform === "android") return FLIPVISE_OFFLINE_SHELL_ANDROID_URL;

  if (platform === "ios" || isIosUserAgent(navigator.userAgent)) {
    return FLIPVISE_OFFLINE_SHELL_IOS_URL;
  }

  return FLIPVISE_OFFLINE_SHELL_ANDROID_URL;
}

/**
 * Navigate back to the bundled offline Study shell — no async work before navigation.
 * Use from button handlers so taps feel instant even when Clerk is still loading.
 */
export function navigateToOfflineShellFast(): void {
  if (typeof window === "undefined") return;

  void import("@/lib/offline/session")
    .then((s) => s.markLastLiveDashboardVisit())
    .catch(() => {});

  if (isFlipviseNativeShell()) {
    try {
      if (Capacitor.getPlatform() === "ios") {
        void import("@/lib/capacitor/flipvise-shell-plugin")
          .then(({ FlipviseShell }) => FlipviseShell.openOfflineShell())
          .catch(() => {
            window.location.replace(resolveOfflineShellUrl());
          });
        return;
      }
    } catch {
      // Plugin unavailable (older build) — fall back to in-webview navigation.
    }
  }

  window.location.replace(resolveOfflineShellUrl());
}

/**
 * Navigate back to the bundled offline Study shell inside the Capacitor WebView.
 * On iOS, prefers the native `FlipviseShell` plugin so navigation never escapes to Safari.
 */
export async function navigateToOfflineShell(): Promise<void> {
  navigateToOfflineShellFast();
}

/**
 * True when running inside the Flipvise Capacitor app WebView (not external Chrome/Safari).
 *
 * Uses Capacitor bridge detection first, then UA / session / query fallbacks for Android
 * after `allowNavigation` redirects where the bridge may not report `isNativePlatform()`.
 */
export function isFlipviseNativeApp(): boolean {
  if (typeof window === "undefined") return false;

  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor;
  if (cap?.isNativePlatform?.()) return true;

  if (navigator.userAgent.includes(FLIPVISE_NATIVE_UA_MARKER)) return true;

  try {
    if (sessionStorage.getItem("flipvise.native") === "1") return true;
  } catch {
    // ignore
  }

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get(FLIPVISE_NATIVE_QUERY_PARAM) === "1") return true;
  } catch {
    // ignore
  }

  return false;
}

/**
 * Strict native check for gating native-only UI (e.g. "Offline study" / "Make
 * available offline" on the dashboard).
 *
 * Unlike {@link isFlipviseNativeApp}, this intentionally ignores the sticky
 * heuristics — `sessionStorage`, the `?flipvise_native=1` query param, and the
 * persisted native flag (which Capacitor Preferences stores in `localStorage` on
 * the web). Those can leak into a normal browser/PWA tab and falsely show
 * native-only controls. We trust only signals a real browser can never fake:
 * the Capacitor bridge, and the WebView user-agent marker (`appendUserAgent`),
 * which survives in-app navigation from the offline shell to the live site.
 */
export function isFlipviseNativeShell(): boolean {
  if (typeof window === "undefined") return false;

  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor;
  if (cap?.isNativePlatform?.()) return true;

  return navigator.userAgent.includes(FLIPVISE_NATIVE_UA_MARKER);
}

/** Like {@link isFlipviseNativeApp} but also checks native Preferences (set by the offline shell). */
export async function isFlipviseNativeAppAsync(): Promise<boolean> {
  if (isFlipviseNativeApp()) return true;
  try {
    const { getNativeAppFlag } = await import("./session");
    return await getNativeAppFlag();
  } catch {
    return false;
  }
}
