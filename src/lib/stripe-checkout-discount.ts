import type { PlanConfig } from "@/components/pricing-content";
import { getAffiliateByPromotionalCode } from "@/db/queries/affiliates";
import {
  affiliateStripeCouponId,
  buildAffiliatePlanCouponName,
  buildCheckoutInvoiceCouponName,
  STRIPE_COUPON_NAME_MAX_LEN,
} from "@/lib/affiliate-stripe-coupon";
import {
  isAffiliateDiscountEffectivelyActive,
  isGeneralDiscountEffectivelyActive,
  isPlanPromoExpired,
  isPromoWindowActive,
  promoEndsAtToRedeemByUnix,
  resolvePlanPromoWindow,
} from "@/lib/plan-promo-window";
import { stripe } from "@/lib/stripe";
import { STRIPE_PAID_PLAN_IDS, type StripePaidPlanId } from "@/lib/billing-plan-ids";
import { checkoutPlanNoDiscountPromoError } from "@/lib/checkout-promo-errors";
import { assertPromoAvailableForCheckout } from "@/lib/promo-redemption";
import type Stripe from "stripe";

type PaidPlanId = StripePaidPlanId;

export type ResolvedCheckoutDiscount = {
  couponId: string | null;
  allowPromotionCodes: boolean;
  affiliateId: number | null;
  /** Code the customer entered (or the tier’s general code when auto-applied). */
  customerPromoCode: string | null;
  promoKind: "general" | "affiliate" | null;
  percentOff: number | null;
};

/** Sets Stripe coupon `name` so hosted invoices/receipts show the promo code used. */
export async function stampStripeCouponInvoiceLabel(opts: {
  couponId: string;
  customerPromoCode: string;
  kind: "general" | "affiliate";
  percentOff: number;
}): Promise<void> {
  let percentOff = Math.round(opts.percentOff);
  if (opts.kind === "general") {
    try {
      const coupon = await stripe.coupons.retrieve(opts.couponId);
      if (typeof coupon.percent_off === "number" && coupon.percent_off > 0) {
        percentOff = Math.round(coupon.percent_off);
      }
    } catch {
      // Keep plan-config percent when Stripe lookup fails.
    }
  }

  const name = buildCheckoutInvoiceCouponName({
    customerPromoCode: opts.customerPromoCode,
    kind: opts.kind,
    percentOff,
  });
  try {
    await stripe.coupons.update(opts.couponId, { name });
  } catch (err) {
    console.error("[stampStripeCouponInvoiceLabel]", opts.couponId, err);
  }
}

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

/** Coupon id Stripe applies on the invoice (direct coupon id or promotion code’s backing coupon). */
export async function resolveUnderlyingStripeCouponId(
  configuredId: string,
): Promise<string> {
  const id = configuredId.trim();
  if (!id) {
    throw new Error("Discount identifier is empty.");
  }

  try {
    await stripe.coupons.retrieve(id);
    return id;
  } catch (err) {
    if (!isStripeResourceMissing(err)) throw err;
  }

  const listed = await stripe.promotionCodes.list({
    code: id,
    active: true,
    limit: 1,
  });
  const pc = listed.data[0];
  if (pc && promotionCodeIsUsable(pc)) {
    const expanded = await stripe.promotionCodes.retrieve(pc.id, {
      expand: ["promotion.coupon"],
    });
    const raw = expanded as unknown as Record<string, unknown>;
    const promotion = raw.promotion as Record<string, unknown> | undefined;
    const coupon = promotion?.coupon;
    if (typeof coupon === "string") return coupon;
    if (
      coupon &&
      typeof coupon === "object" &&
      typeof (coupon as { id?: string }).id === "string"
    ) {
      return (coupon as { id: string }).id;
    }
  }

  throw new Error(`No Stripe coupon matches "${id}".`);
}

function generalCouponDisplayName(
  planId: string,
  label: string | undefined,
  discount: PlanConfig["discount"],
): string {
  const raw =
    label?.trim() ||
    (discount?.type === "percentage" && discount.value > 0
      ? `${planId} ${discount.value}% off`
      : `${planId} promo`);
  return raw.length <= STRIPE_COUPON_NAME_MAX_LEN
    ? raw
    : raw.slice(0, STRIPE_COUPON_NAME_MAX_LEN);
}

/**
 * Creates the tier’s general marketing Coupon in Stripe when admin enables a discount in
 * `plans-config.json` — avoids manual Dashboard setup per `stripeCouponId`.
 */
export async function ensureGeneralPlanStripeCoupon(opts: {
  planId: PaidPlanId;
  discount: NonNullable<PlanConfig["discount"]>;
  discontinueAt?: string | null;
}): Promise<string> {
  const id = opts.discount.stripeCouponId.trim();
  if (!id) {
    throw new Error("Plan discount is missing stripeCouponId in plans config.");
  }
  if (id.startsWith("fv_aff_")) {
    return id;
  }

  const value = Math.round(opts.discount.value ?? 0);
  if (value <= 0) {
    throw new Error("Plan discount value must be greater than zero.");
  }

  const discontinueRaw = opts.discontinueAt?.trim() ?? "";
  const redeemBy = discontinueRaw.includes("T")
    ? promoEndsAtToRedeemByUnix(discontinueRaw)
    : discontinueRaw
      ? promoEndsAtToRedeemByUnix(`${discontinueRaw}T23:59`)
      : undefined;
  const name = generalCouponDisplayName(
    opts.planId,
    opts.discount.label,
    opts.discount,
  );

  const createParams: Stripe.CouponCreateParams = {
    id,
    duration: "forever",
    name,
    ...(opts.discount.type === "percentage"
      ? { percent_off: Math.min(100, value) }
      : { amount_off: Math.round(value * 100), currency: "usd" }),
    ...(redeemBy != null ? { redeem_by: redeemBy } : {}),
  };

  try {
    const existing = await stripe.coupons.retrieve(id);
    if (redeemBy != null && existing.redeem_by !== redeemBy) {
      await stripe.coupons.update(id, { redeem_by: redeemBy } as Parameters<
        typeof stripe.coupons.update
      >[1]);
    }
  } catch (err) {
    if (!isStripeResourceMissing(err)) throw err;
    await stripe.coupons.create(createParams);
  }

  return id;
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
  const redeemBy = discontinueRaw.includes("T")
    ? promoEndsAtToRedeemByUnix(discontinueRaw)
    : discontinueRaw
      ? promoEndsAtToRedeemByUnix(`${discontinueRaw}T23:59`)
      : undefined;
  const id = affiliateStripeCouponId(
    opts.planId,
    pct,
    discontinueRaw ? discontinueRaw.slice(0, 10) : null,
  );

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
  userId?: string | null;
}): Promise<ResolvedCheckoutDiscount> {
  const { plansConfig, promotionCodeInput, userId } = opts;
  const planId = opts.planId;

  if (!isPaidPlanId(planId)) {
    throw new Error("Invalid plan.");
  }

  const planRow = plansConfig.find((p) => p.id === planId);
  const baseCoupon = planRow?.discount?.stripeCouponId?.trim() ?? "";
  const generalActive = planRow != null && isGeneralDiscountEffectivelyActive(planRow);
  const { endsAt: promoEndsAt } = planRow
    ? resolvePlanPromoWindow(planRow)
    : { endsAt: null };

  const trimmed = (promotionCodeInput ?? "").trim();

  const finalize = async (
    resolved: ResolvedCheckoutDiscount,
  ): Promise<ResolvedCheckoutDiscount> => {
    if (userId) {
      await assertPromoAvailableForCheckout({
        userId,
        discount: resolved,
        plansConfig,
      });
    }
    return resolved;
  };

  if (!trimmed) {
    if (generalActive && planRow?.discount) {
      return finalize({
        couponId: baseCoupon,
        allowPromotionCodes: false,
        affiliateId: null,
        customerPromoCode: baseCoupon,
        promoKind: "general",
        percentOff:
          planRow.discount.type === "percentage"
            ? Math.round(planRow.discount.value)
            : null,
      });
    }
    return {
      couponId: null,
      allowPromotionCodes: true,
      affiliateId: null,
      customerPromoCode: null,
      promoKind: null,
      percentOff: null,
    };
  }

  if (!baseCoupon) {
    throw checkoutPlanNoDiscountPromoError(planRow?.name ?? planId);
  }

  const lower = trimmed.toLowerCase();
  const baseLower = baseCoupon.toLowerCase();

  if (lower === baseLower) {
    if (planRow && isPlanPromoExpired(planRow)) {
      throw new Error("This promotion has expired and is no longer accepted at checkout.");
    }
    if (planRow && !generalActive) {
      const { startsAt, endsAt } = resolvePlanPromoWindow(planRow);
      if (startsAt && endsAt && !isPromoWindowActive(startsAt, endsAt)) {
        throw new Error("This promotion is not active yet or has expired.");
      }
      throw new Error("This general promotion is not active for checkout.");
    }
    return finalize({
      couponId: baseCoupon,
      allowPromotionCodes: false,
      affiliateId: null,
      customerPromoCode: trimmed,
      promoKind: "general",
      percentOff:
        planRow?.discount?.type === "percentage"
          ? Math.round(planRow.discount.value)
          : null,
    });
  }

  const affiliate = await resolveAffiliateFromCombinedPromotionInput(lower, plansConfig);
  if (affiliate) {
    if (affiliate.status !== "active") {
      throw new Error("That affiliate promotion is not active yet.");
    }

    if (!planRow || !isAffiliateDiscountEffectivelyActive(planRow)) {
      if (planRow && isPlanPromoExpired(planRow)) {
        throw new Error("This affiliate promotion has expired and is no longer accepted at checkout.");
      }
      throw new Error("Affiliate pricing is not enabled for this plan in admin.");
    }

    const aff = planRow.affiliateDiscount!;
    const pct = Math.round(aff.value);
    const couponId = await ensureAffiliatePlanStripeCoupon({
      planId,
      percent: pct,
      discontinueAt: promoEndsAt ?? planRow.discontinueAt ?? null,
    });
    return finalize({
      couponId,
      allowPromotionCodes: false,
      affiliateId: affiliate.id,
      customerPromoCode: trimmed,
      promoKind: "affiliate",
      percentOff: pct,
    });
  }

  if (lower.startsWith(baseLower)) {
    throw new Error("Unknown affiliate promotion code.");
  }

  throw new Error("Invalid promotion code for this plan.");
}
