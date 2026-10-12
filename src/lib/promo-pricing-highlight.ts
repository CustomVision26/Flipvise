import { getAffiliateByPromotionalCode } from "@/db/queries/affiliates";
import { getSpecialFeaturePromoByCode } from "@/db/queries/special-feature-promos";
import type { PlanConfig } from "@/lib/plan-config-types";
import { isAffiliateDiscountEffectivelyActive } from "@/lib/plan-promo-window";

/** Plan ids a customer-facing code can be used with on the pricing page. */
export async function listPromoHighlightPlanIds(
  code: string,
  plans: PlanConfig[],
): Promise<string[]> {
  const trimmed = code.trim();
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();

  const general = plans
    .filter((plan) => plan.discount?.stripeCouponId?.trim().toLowerCase() === lower)
    .map((plan) => plan.id);
  if (general.length > 0) return general;

  const special = await getSpecialFeaturePromoByCode(trimmed);
  if (special?.active) {
    const now = Date.now();
    if (special.startsAt && special.startsAt.getTime() > now) return [];
    if (special.endsAt && special.endsAt.getTime() < now) return [];
    const allowed = new Set(special.planIds);
    return plans.filter((plan) => allowed.has(plan.id)).map((plan) => plan.id);
  }

  const bases = plans
    .map((plan) => plan.discount?.stripeCouponId?.trim().toLowerCase() ?? "")
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const base of bases) {
    if (!lower.startsWith(base) || lower.length <= base.length) continue;
    const suffix = lower.slice(base.length);
    const affiliate = await getAffiliateByPromotionalCode(suffix);
    if (!affiliate || affiliate.status !== "active") continue;
    return plans
      .filter(
        (plan) =>
          plan.discount?.stripeCouponId?.trim().toLowerCase() === base &&
          isAffiliateDiscountEffectivelyActive(plan),
      )
      .map((plan) => plan.id);
  }

  return [];
}
