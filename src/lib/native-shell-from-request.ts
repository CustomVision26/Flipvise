/** Appended to the WebView user agent via `capacitor.config.ts` (`appendUserAgent`). */
export const FLIPVISE_NATIVE_UA_MARKER = "FlipviseNative";

export type NativeShellPlatform = "ios" | "android";

/** Server-side detection from the incoming request User-Agent (Capacitor WebView). */
export function detectNativeShellFromUserAgent(userAgent: string): {
  isNativeShell: boolean;
  platform?: NativeShellPlatform;
} {
  const ua = userAgent.trim();
  if (!new RegExp(`${FLIPVISE_NATIVE_UA_MARKER}/`, "i").test(ua)) {
    return { isNativeShell: false };
  }

  if (
    /\b(iPhone|iPad|iPod)\b/i.test(ua) ||
    (/\bMacintosh\b/i.test(ua) && /\biPad\b/i.test(ua))
  ) {
    return { isNativeShell: true, platform: "ios" };
  }

  if (/Android/i.test(ua)) {
    return { isNativeShell: true, platform: "android" };
  }

  return { isNativeShell: true };
}
