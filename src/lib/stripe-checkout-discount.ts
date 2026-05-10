import type { PlanConfig } from "@/components/pricing-content";
import { getAffiliateByPromotionalCode } from "@/db/queries/affiliates";
import {
  affiliateStripeCouponId,
  buildAffiliatePlanCouponName,
  discontinueDateToRedeemByUnix,
} from "@/lib/affiliate-stripe-coupon";
import { stripe } from "@/lib/stripe";
import { STRIPE_PAID_PLAN_IDS, type StripePaidPlanId } from "@/lib/billing-plan-ids";
import type Stripe from "stripe";

type PaidPlanId = StripePaidPlanId;

export type ResolvedCheckoutDiscount = {
  couponId: string | null;
  allowPromotionCodes: boolean;
  affiliateId: number | null;
};

function isStripeResourceMissing(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "resource_missing"
  );
}

function promotionCodeIsUsable(pc: Stripe.PromotionCode): boolean {
  if (!pc.active) return false;
  if (pc.expires_at != null && pc.expires_at <= Math.floor(Date.now() / 1000)) {
    return false;
  }
  return true;
}

/**
 * Checkout `discounts` accepts either a Coupon id or a PromotionCode id (`promo_…`).
 * Plans config often stores the customer-facing code, which in Stripe is a **Promotion code**
 * tied to a coupon with a different internal id — so we resolve both shapes.
 */
export async function resolveStripeCheckoutDiscountPayload(
  configuredId: string,
): Promise<{ coupon: string } | { promotion_code: string }> {
  const id = configuredId.trim();
  if (!id) {
    throw new Error("Discount identifier is empty.");
  }

  try {
    await stripe.coupons.retrieve(id);
    return { coupon: id };
  } catch (err) {
    if (isStripeResourceMissing(err)) {
      // Not a coupon id — try customer-facing promotion code.
    } else {
      throw err;
    }
  }

  const listed = await stripe.promotionCodes.list({
    code: id,
    active: true,
    limit: 1,
  });
  const pc = listed.data[0];
  if (pc && promotionCodeIsUsable(pc)) {
    return { promotion_code: pc.id };
  }

  throw new Error(
    `No Stripe coupon or active promotion code matches "${id}". In the Stripe Dashboard, either create a Coupon with this exact id, or create a Promotion code with this customer-facing code (same Stripe mode as STRIPE_SECRET_KEY).`,
  );
}

/**
 * Ensures a Stripe Coupon exists for affiliate checkout on this plan.
 * When `discontinueAt` is set, the coupon id is plan-scoped and `redeem_by` matches that date (UTC end of day),
 * aligned with the tier’s general promotion / discontinuation window.
 */
export async function ensureAffiliatePlanStripeCoupon(opts: {
  planId: PaidPlanId;
  percent: number;
  discontinueAt?: string | null;
}): Promise<string> {
  const pct = Math.round(opts.percent);
  if (pct < 1 || pct > 100) {
    throw new Error("Affiliate discount must be a whole percent between 1 and 100.");
  }

  const discontinueRaw = opts.discontinueAt?.trim() ?? "";
  const redeemBy = discontinueRaw ? discontinueDateToRedeemByUnix(discontinueRaw) : undefined;
  const id = affiliateStripeCouponId(opts.planId, pct, discontinueRaw || null);

  try {
    const existing = await stripe.coupons.retrieve(id);
    if (redeemBy != null && existing.redeem_by !== redeemBy) {
      // Stripe’s generated `CouponUpdateParams` omits `redeem_by` in some SDK versions, but the API accepts it.
      await stripe.coupons.update(id, { redeem_by: redeemBy } as Parameters<
        typeof stripe.coupons.update
      >[1]);
    }
    return id;
  } catch (err) {
    if (!isStripeResourceMissing(err)) throw err;
  }

  await stripe.coupons.create({
    id,
    percent_off: pct,
    duration: "forever",
    name: buildAffiliatePlanCouponName(opts.planId, pct, discontinueRaw),
    ...(redeemBy != null ? { redeem_by: redeemBy } : {}),
  });
  return id;
}

function isPaidPlanId(id: string): id is PaidPlanId {
  return (STRIPE_PAID_PLAN_IDS as readonly string[]).includes(id);
}

/**
 * Parses combined affiliate input by finding the longest matching `discount.stripeCouponId` prefix
 * across all paid tiers (handles Pro vs Pro Plus using different base strings, e.g.
 * SummerLaunch26 vs SummerLaunchProPlus26). The checkout plan still receives its own affiliate %.
 */
async function resolveAffiliateFromCombinedPromotionInput(
  lowerTrimmed: string,
  plansConfig: PlanConfig[],
): Promise<Awaited<ReturnType<typeof getAffiliateByPromotionalCode>> | null> {
  const bases = new Set<string>();
  for (const p of plansConfig) {
    if (p.id === "free") continue;
    const b = p.discount?.stripeCouponId?.trim();
    if (b) bases.add(b.toLowerCase());
  }
  const sorted = [...bases].sort((a, b) => b.length - a.length);

  for (const baseLower of sorted) {
    if (!lowerTrimmed.startsWith(baseLower)) continue;
    if (lowerTrimmed.length <= baseLower.length) continue;
    const suffix = lowerTrimmed.slice(baseLower.length);
    if (!suffix) continue;
    const affiliate = await getAffiliateByPromotionalCode(suffix);
    if (affiliate) return affiliate;
  }

  return null;
}

/**
 * Resolves Stripe Checkout discounts for subscription checkout.
 * - Empty user input: auto-applies configured general coupon when active; otherwise allows Stripe promotion codes.
 * - User input matching the plan's general Stripe coupon id applies that coupon.
 * - Combined affiliate code: longest match against any paid plan’s `discount.stripeCouponId` prefix, then
 *   affiliate suffix; discount % comes from the checkout plan (so Pro vs Pro Plus can share one printed code).
 */
export async function resolveCheckoutDiscount(opts: {
  planId: string;
  promotionCodeInput: string | null | undefined;
  plansConfig: PlanConfig[];
}): Promise<ResolvedCheckoutDiscount> {
  const { plansConfig, promotionCodeInput } = opts;
  const planId = opts.planId;

  if (!isPaidPlanId(planId)) {
    throw new Error("Invalid plan.");
  }

  const planRow = plansConfig.find((p) => p.id === planId);
  const baseCoupon = planRow?.discount?.stripeCouponId?.trim() ?? "";
  const generalActive =
    !!planRow?.discount?.active &&
    (planRow.discount.value ?? 0) > 0 &&
    baseCoupon.length > 0;

  const trimmed = (promotionCodeInput ?? "").trim();

  if (!trimmed) {
    if (generalActive) {
      return {
        couponId: baseCoupon,
        allowPromotionCodes: false,
        affiliateId: null,
      };
    }
    return { couponId: null, allowPromotionCodes: true, affiliateId: null };
  }

  if (!baseCoupon) {
    throw new Error(
      "This plan does not have a Stripe coupon id configured in admin — entering a code is not supported for this tier.",
    );
  }

  const lower = trimmed.toLowerCase();
  const baseLower = baseCoupon.toLowerCase();

  if (lower === baseLower) {
    return { couponId: baseCoupon, allowPromotionCodes: false, affiliateId: null };
  }

  const affiliate = await resolveAffiliateFromCombinedPromotionInput(lower, plansConfig);
  if (affiliate) {
    if (affiliate.status !== "active") {
      throw new Error("That affiliate promotion is not active yet.");
    }

    const aff = planRow?.affiliateDiscount;
    if (!aff?.active || (aff.value ?? 0) <= 0) {
      throw new Error("Affiliate pricing is not enabled for this plan in admin.");
    }

    const pct = Math.round(aff.value);
    const couponId = await ensureAffiliatePlanStripeCoupon({
      planId,
      percent: pct,
      discontinueAt: planRow?.discontinueAt ?? null,
    });
    return { couponId, allowPromotionCodes: false, affiliateId: affiliate.id };
  }

  if (lower.startsWith(baseLower)) {
    throw new Error("Unknown affiliate promotion code.");
  }

  throw new Error("Invalid promotion code for this plan.");
}
