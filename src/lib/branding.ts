/** Public path for the app logo — processed from `logo/logo.png` → `public/logo.png` via `npm run logo:transparent`. */
export const LOGO_PUBLIC_URL = "/logo.png" as const;

/** Square icon for browser tab favicon and PWA install (matches native app icon). */
export const PWA_ICON_URL = "/pwa-icon.png" as const;
export const PWA_ICON_192_URL = "/pwa-icon-192.png" as const;
export const FAVICON_ICO_URL = "/favicon.ico" as const;
export const FAVICON_32_URL = "/favicon-32x32.png" as const;
export const FAVICON_16_URL = "/favicon-16x16.png" as const;
export const APPLE_TOUCH_ICON_URL = "/apple-touch-icon.png" as const;

/**
 * Absolute logo URL for Clerk modals and other embeds that need a full origin.
 * Falls back to the public path when `NEXT_PUBLIC_APP_URL` is unset (local dev).
 */
export function resolveLogoImageUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (!base) return LOGO_PUBLIC_URL;
  return `${base}${LOGO_PUBLIC_URL}`;
}
