/** Public path for the app logo — processed from `logo/logo.png` → `public/logo.png` via `npm run logo:transparent`. */
export const LOGO_PUBLIC_URL = "/logo.png" as const;

/**
 * Absolute logo URL for Clerk modals and other embeds that need a full origin.
 * Falls back to the public path when `NEXT_PUBLIC_APP_URL` is unset (local dev).
 */
export function resolveLogoImageUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (!base) return LOGO_PUBLIC_URL;
  return `${base}${LOGO_PUBLIC_URL}`;
}
