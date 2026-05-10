import type { StripePaidPlanId } from "@/lib/billing-plan-ids";

const COUPON_ID_PREFIX = "fv_aff_pct_";

/** Stripe `Coupon.name` max length (API rejects longer values). */
export const STRIPE_COUPON_NAME_MAX_LEN = 40;

/** Last second of `YYYY-MM-DD` in UTC — Stripe `redeem_by` for “code valid through this calendar day”. */
export function discontinueDateToRedeemByUnix(isoDate: string): number {
  const [y, m, d] = isoDate.trim().split("-").map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid plan discontinue date: "${isoDate}"`);
  }
  return Math.floor(Date.UTC(y, m - 1, d, 23, 59, 59) / 1000);
}

/**
 * Affiliate coupons are per-plan when the plan has a `discontinueAt` (same cutoff as the tier’s promo window).
 * Otherwise a shared `fv_aff_pct_{n}` coupon is used (no `redeem_by` from the app).
 */
export function affiliateStripeCouponId(
  planId: StripePaidPlanId,
  pct: number,
  discontinueAt: string | null | undefined,
): string {
  const base = `${COUPON_ID_PREFIX}${pct}`;
  return discontinueAt?.trim() ? `${base}_${planId}` : base;
}

/**
 * Human-readable Stripe coupon name, always ≤ {@link STRIPE_COUPON_NAME_MAX_LEN}.
 * (Stripe rejects longer `name` strings — e.g. "Affiliate 18% (pro_plus) · ends 2026-05-18".)
 */
export function buildAffiliatePlanCouponName(
  planId: string,
  pct: number,
  discontinueRaw: string,
): string {
  const d = discontinueRaw.trim();
  /** `2026-05-18` → `26-05-18` to save characters */
  const dateCompact =
    /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(2, 4)}-${d.slice(5, 7)}-${d.slice(8, 10)}` : d;

  const tryName = (compact: boolean): string => {
    const tag = compact ? "Aff" : "Affiliate";
    if (!dateCompact) return `${tag} ${pct}% ${planId}`;
    return `${tag} ${pct}% ${planId} ${dateCompact}`;
  };

  let name = tryName(false);
  if (name.length > STRIPE_COUPON_NAME_MAX_LEN) name = tryName(true);
  if (name.length > STRIPE_COUPON_NAME_MAX_LEN) {
    name = name.slice(0, STRIPE_COUPON_NAME_MAX_LEN);
  }
  return name;
}
