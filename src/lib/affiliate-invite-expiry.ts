/** Default: pending affiliate invites must be accepted within this many days (server env can override). */
export const DEFAULT_AFFILIATE_INVITE_EXPIRY_DAYS = 14;

/**
 * Reads `AFFILIATE_INVITE_EXPIRY_DAYS` (1–365). Invalid or missing values use {@link DEFAULT_AFFILIATE_INVITE_EXPIRY_DAYS}.
 * Server-only (uses `process.env`).
 */
export function getAffiliateInviteExpiryDays(): number {
  const raw = process.env.AFFILIATE_INVITE_EXPIRY_DAYS?.trim();
  if (!raw) return DEFAULT_AFFILIATE_INVITE_EXPIRY_DAYS;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1) return DEFAULT_AFFILIATE_INVITE_EXPIRY_DAYS;
  return Math.min(n, 365);
}

/** Wall-clock instant when a new or refreshed invite link stops accepting sign-ups. */
export function computeAffiliateInviteExpiresAtFromDays(
  days: number,
  from: Date = new Date(),
): Date {
  const clamped = Math.min(365, Math.max(1, Math.round(days)));
  const ms = 1000 * 60 * 60 * 24 * clamped;
  return new Date(from.getTime() + ms);
}

/** Uses server default / `AFFILIATE_INVITE_EXPIRY_DAYS`. */
export function computeAffiliateInviteExpiresAt(from: Date = new Date()): Date {
  return computeAffiliateInviteExpiresAtFromDays(getAffiliateInviteExpiryDays(), from);
}

/** True when the invite link is past its acceptance deadline (pending rows only). */
export function isAffiliateInviteExpired(inviteExpiresAt: Date, now: Date = new Date()): boolean {
  return inviteExpiresAt.getTime() < now.getTime();
}
