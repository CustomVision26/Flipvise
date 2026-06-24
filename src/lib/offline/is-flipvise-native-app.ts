"use client";

/** Appended to the WebView user agent via `capacitor.config.ts` (`android.appendUserAgent`). */
export const FLIPVISE_NATIVE_UA_MARKER = "FlipviseNative";

/** Query param set when navigating from the bundled offline shell to the live site. */
export const FLIPVISE_NATIVE_QUERY_PARAM = "flipvise_native";

/** Capacitor bundled-app entry URL (`androidScheme: https`, default hostname). */
export const FLIPVISE_OFFLINE_SHELL_URL = "https://localhost/";

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
