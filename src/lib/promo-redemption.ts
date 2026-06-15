import type { PlanConfig } from "@/lib/plan-config-types";
import { parsePromoFromDiscountLabel } from "@/lib/admin-invoice-promo-display";
import { listPromoCodesUsedByUser } from "@/db/queries/promo-redemption";
import { checkoutPromoAlreadyRedeemedError } from "@/lib/checkout-promo-errors";
import type { ResolvedCheckoutDiscount } from "@/lib/stripe-checkout-discount";

/** All general promo base codes from paid tiers (e.g. SUMMER26). */
export function collectPromoCampaignBases(plansConfig: PlanConfig[]): string[] {
  const bases = new Set<string>();
  for (const plan of plansConfig) {
    if (plan.id === "free") continue;
    const base = plan.discount?.stripeCouponId?.trim();
    if (base) bases.add(base.toLowerCase());
  }
  return [...bases];
}

/**
 * Maps a customer-facing code (general or affiliate-combined) to its campaign base.
 * Affiliate codes like `SUMMER26usera1276` resolve to `summer26`.
 */
export function promoCodeToCampaignBase(
  code: string,
  plansConfig: PlanConfig[],
): string {
  const lower = code.trim().toLowerCase();
  if (!lower) return lower;

  const bases = collectPromoCampaignBases(plansConfig).sort(
    (a, b) => b.length - a.length,
  );

  for (const base of bases) {
    if (lower === base || lower.startsWith(base)) {
      return base;
    }
  }

  return lower;
}

export async function hasUserRedeemedPromoCampaign(
  userId: string,
  campaignBase: string,
  plansConfig: PlanConfig[],
): Promise<boolean> {
  const target = campaignBase.trim().toLowerCase();
  if (!target) return false;

  const usedCodes = await listPromoCodesUsedByUser(userId);
  for (const used of usedCodes) {
    if (promoCodeToCampaignBase(used, plansConfig) === target) {
      return true;
    }
  }
  return false;
}

export async function assertPromoAvailableForCheckout(input: {
  userId: string;
  discount: ResolvedCheckoutDiscount;
  plansConfig: PlanConfig[];
}): Promise<void> {
  const code = input.discount.customerPromoCode?.trim();
  if (!code || input.discount.couponId == null) return;

  const campaign = promoCodeToCampaignBase(code, input.plansConfig);
  const alreadyUsed = await hasUserRedeemedPromoCampaign(
    input.userId,
    campaign,
    input.plansConfig,
  );
  if (alreadyUsed) {
    throw checkoutPromoAlreadyRedeemedError(code);
  }
}

/** Normalize invoice / subscription stored promos into comparable codes. */
export function promoCodeFromStoredFields(input: {
  promoCode?: string | null;
  discountLabel?: string | null;
}): string | null {
  const direct = input.promoCode?.trim();
  if (direct) return direct;

  const parsed = parsePromoFromDiscountLabel(input.discountLabel);
  return parsed.promoCode?.trim() || null;
}
