/**
 * Diagnoses why Clerk may never finish loading inside the Capacitor WebView.
 *
 * Preferred Android emulator path: http://127.0.0.1:3000 + `adb reverse tcp:3000 tcp:3000`.
 * That origin is Clerk-compatible (localhost-equivalent) and does not collide with
 * Capacitor’s offline shell at https://localhost/.
 *
 * http://10.0.2.2:3000 works for networking without adb reverse, but Clerk test keys
 * often block that origin until it is added under Authorized origins.
 */
export function diagnoseNativeClerkHost(): {
  host: string;
  origin: string;
  isEmulatorAliasHost: boolean;
  isLocalhostHost: boolean;
  clerkLikelyBlockedByOrigin: boolean;
  guidance: string | null;
} {
  if (typeof window === "undefined") {
    return {
      host: "",
      origin: "",
      isEmulatorAliasHost: false,
      isLocalhostHost: false,
      clerkLikelyBlockedByOrigin: false,
      guidance: null,
    };
  }

  const host = window.location.hostname;
  const origin = window.location.origin;
  const isEmulatorAliasHost = host === "10.0.2.2";
  const isLocalhostHost =
    host === "localhost" || host === "127.0.0.1" || host === "::1";
  const clerkLikelyBlockedByOrigin = isEmulatorAliasHost;

  const guidance = clerkLikelyBlockedByOrigin
    ? "This page is on http://10.0.2.2, which Clerk often blocks. Prefer the fixed emulator path: on your PC run adb reverse tcp:3000 tcp:3000, then npm run mobile:sync:dev (uses http://127.0.0.1:3000), rebuild the app, and try Online Dashboard again. Or add http://10.0.2.2:3000 in Clerk Dashboard → Authorized origins."
    : null;

  return {
    host,
    origin,
    isEmulatorAliasHost,
    isLocalhostHost,
    clerkLikelyBlockedByOrigin,
    guidance,
  };
}
