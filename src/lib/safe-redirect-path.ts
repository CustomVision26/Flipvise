/** Default landing if a handoff URL doesn't specify a redirect. */
export const DEFAULT_AUTH_REDIRECT = "/dashboard";

/** Only allow same-origin relative paths as redirect targets. */
export function safeRedirectPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_AUTH_REDIRECT;
  if (!raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_AUTH_REDIRECT;
  return raw;
}

/** Server/client hop that waits for Clerk JWT propagation before landing on `path`. */
export function authContinueUrl(path: string): string {
  const safe = safeRedirectPath(path);
  return `/auth/continue?redirect=${encodeURIComponent(safe)}`;
}
