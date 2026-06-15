import type { PlanConfig } from "@/lib/plan-config-types";

/** Local datetime stored as `YYYY-MM-DDTHH:mm` (admin schedule). */
export const PROMO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function splitPromoDateTime(iso: string | null | undefined): {
  date: string;
  time: string;
} {
  if (!iso?.trim()) return { date: "", time: "" };
  const [date, timePart] = iso.trim().split("T");
  return { date: date ?? "", time: (timePart ?? "00:00").slice(0, 5) };
}

export function joinPromoDateTime(date: string, time: string): string | null {
  const d = date.trim();
  if (!d) return null;
  const t = time.trim() || "00:00";
  return `${d}T${t}`;
}

export function parsePromoDateTimeMs(iso: string): number {
  const trimmed = iso.trim();
  const [datePart, timePart] = trimmed.split("T");
  const [y, m, d] = (datePart ?? "").split("-").map(Number);
  const [hh, mm] = (timePart ?? "00:00").split(":").map(Number);
  if (!y || !m || !d) return NaN;
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0).getTime();
}

export function resolvePlanPromoWindow(plan: PlanConfig): {
  startsAt: string | null;
  endsAt: string | null;
} {
  const endsAt =
    plan.promoEndsAt?.trim() ||
    (plan.discontinueAt?.trim() ? `${plan.discontinueAt.trim()}T23:59` : null);
  const startsAt =
    plan.promoStartsAt?.trim() ||
    (endsAt ? `${endsAt.slice(0, 10)}T00:00` : null);
  return { startsAt, endsAt };
}

export function planHasCompletePromoWindow(plan: PlanConfig): boolean {
  const { startsAt, endsAt } = resolvePlanPromoWindow(plan);
  return !!(startsAt && endsAt && PROMO_DATETIME_RE.test(startsAt) && PROMO_DATETIME_RE.test(endsAt));
}

export function isPromoWindowActive(
  startsAt: string | null,
  endsAt: string | null,
  nowMs: number = Date.now(),
): boolean {
  if (!endsAt?.trim()) return false;
  const endMs = parsePromoDateTimeMs(endsAt);
  if (Number.isNaN(endMs) || nowMs > endMs) return false;
  if (startsAt?.trim()) {
    const startMs = parsePromoDateTimeMs(startsAt);
    if (Number.isNaN(startMs) || nowMs < startMs) return false;
  }
  return true;
}

export function isPlanPromoExpired(plan: PlanConfig, nowMs: number = Date.now()): boolean {
  const { endsAt } = resolvePlanPromoWindow(plan);
  if (!endsAt) return false;
  const endMs = parsePromoDateTimeMs(endsAt);
  return !Number.isNaN(endMs) && nowMs > endMs;
}

export function isGeneralDiscountEffectivelyActive(
  plan: PlanConfig,
  nowMs: number = Date.now(),
): boolean {
  if (plan.id === "free") return false;
  const d = plan.discount;
  if (!d?.active || d.value <= 0 || !d.stripeCouponId?.trim()) return false;
  const { startsAt, endsAt } = resolvePlanPromoWindow(plan);
  if (!startsAt || !endsAt) return false;
  return isPromoWindowActive(startsAt, endsAt, nowMs);
}

export function isAffiliateDiscountEffectivelyActive(
  plan: PlanConfig,
  nowMs: number = Date.now(),
): boolean {
  if (plan.id === "free") return false;
  const base = plan.discount?.stripeCouponId?.trim();
  const aff = plan.affiliateDiscount;
  if (!base || !aff?.active || (aff.value ?? 0) <= 0) return false;
  const { startsAt, endsAt } = resolvePlanPromoWindow(plan);
  if (!startsAt || !endsAt) return false;
  return isPromoWindowActive(startsAt, endsAt, nowMs);
}

/** Stripe `redeem_by` — last second of the configured promo end datetime (local → UTC unix). */
export function promoEndsAtToRedeemByUnix(promoEndsAt: string): number {
  return Math.floor(parsePromoDateTimeMs(promoEndsAt) / 1000);
}

export function formatPromoDateTimeLabel(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const ms = parsePromoDateTimeMs(iso);
  if (Number.isNaN(ms)) return iso;
  return new Date(ms).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatGeneralDiscountAmount(plan: PlanConfig): string {
  const d = plan.discount;
  if (!d || d.value <= 0) return "—";
  return d.type === "percentage" ? `${d.value}% off` : `$${d.value} off`;
}

export function deactivateExpiredPlanPromos(
  plans: PlanConfig[],
  nowMs: number = Date.now(),
): { plans: PlanConfig[]; changed: boolean } {
  let changed = false;
  const next = plans.map((plan) => {
    if (!isPlanPromoExpired(plan, nowMs)) return plan;
    const needsOff = plan.discount?.active || plan.affiliateDiscount?.active;
    if (!needsOff) return plan;
    changed = true;
    return {
      ...plan,
      discount: plan.discount?.active
        ? { ...plan.discount, active: false }
        : plan.discount,
      affiliateDiscount: plan.affiliateDiscount?.active
        ? { ...plan.affiliateDiscount, active: false }
        : plan.affiliateDiscount,
    };
  });
  return { plans: next, changed };
}

export function validatePlanPromoForSave(plan: PlanConfig): string | null {
  if (plan.id === "free") return null;

  const wantsGeneral = !!plan.discount?.active;
  const wantsAffiliate = !!plan.affiliateDiscount?.active;
  if (!wantsGeneral && !wantsAffiliate) return null;

  if (!planHasCompletePromoWindow(plan)) {
    return "Set promotion start and end date and time before activating general or affiliate discounts.";
  }

  const { startsAt, endsAt } = resolvePlanPromoWindow(plan);
  const startMs = parsePromoDateTimeMs(startsAt!);
  const endMs = parsePromoDateTimeMs(endsAt!);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return "Promotion schedule uses an invalid date or time.";
  }
  if (endMs <= startMs) {
    return "Promotion end must be after the start date and time.";
  }

  if (wantsGeneral) {
    if ((plan.discount?.value ?? 0) <= 0) {
      return "General discount value must be greater than zero.";
    }
    if (!plan.discount?.stripeCouponId?.trim()) {
      return "General discount requires a Stripe Coupon ID.";
    }
  }

  if (wantsAffiliate) {
    if ((plan.affiliateDiscount?.value ?? 0) <= 0) {
      return "Affiliate discount percent must be greater than zero.";
    }
    if (!plan.discount?.stripeCouponId?.trim()) {
      return "Affiliate discount requires a Stripe Coupon ID in the general discount section.";
    }
  }

  return null;
}
