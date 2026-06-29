import { safeRedirectPath } from "@/lib/safe-redirect-path";

/** Absolute URL for the live destination (not the /native-signin hop). */
export function liveDestinationUrl(base: string, path: string): string {
  const origin = base.replace(/\/$/, "");
  const safePath = safeRedirectPath(path);
  return `${origin}${safePath}`;
}

/**
 * error.html and recovery flows should retry the dashboard (or deep link), not
 * /native-signin — retrying the sign-in hop caused WebView redirect loops.
 */
export function unwrapNativeSignInRetryUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.includes("/native-signin")) return url;
    const redirect = parsed.searchParams.get("redirect");
    const safePath = safeRedirectPath(redirect);
    return `${parsed.origin}${safePath}`;
  } catch {
    return url;
  }
}

/** True when the request comes from the Flipvise Capacitor WebView. */
export function isFlipviseNativeUserAgent(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent?.includes("FlipviseNative"));
}
