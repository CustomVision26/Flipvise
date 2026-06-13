import type { PlanConfig } from "@/components/pricing-content";
import { formatCombinedPromotionCode } from "@/lib/affiliate-promotional-code";
import {
  formatGeneralDiscountAmount,
  isAffiliateDiscountEffectivelyActive,
  isPlanPromoExpired,
  parsePromoDateTimeMs,
  resolvePlanPromoWindow,
} from "@/lib/plan-promo-window";

export type AffiliateCombinedPromoRow = {
  planId: string;
  planName: string;
  combinedCode: string;
  promoLabel: string;
  generalDiscountDisplay: string;
  affiliatePercent: number;
  startsAt: string | null;
  endsAt: string | null;
  /** ISO date portion of endsAt for compact display */
  validThrough: string | null;
  expired: boolean;
};

export type AffiliatePromoHistoryGroup = {
  promoLabel: string;
  startsAt: string;
  endsAt: string;
  items: Array<{
    planName: string;
    combinedCode: string;
    generalDiscountDisplay: string;
    affiliatePercent: number;
  }>;
};

function planHadAffiliatePromoConfigured(plan: PlanConfig): boolean {
  if (plan.id === "free") return false;
  const base = plan.discount?.stripeCouponId?.trim();
  const affValue = plan.affiliateDiscount?.value ?? 0;
  const { startsAt, endsAt } = resolvePlanPromoWindow(plan);
  return !!(base && affValue > 0 && startsAt && endsAt);
}

/** All affiliate promo rows (active + expired) for portal history. */
export function buildAffiliateCombinedPromoRows(
  plans: PlanConfig[],
  promotionalCode: string,
): AffiliateCombinedPromoRow[] {
  const suffix = promotionalCode.trim().toLowerCase();
  const rows: AffiliateCombinedPromoRow[] = [];

  for (const plan of plans) {
    if (!planHadAffiliatePromoConfigured(plan)) continue;

    const base = plan.discount!.stripeCouponId.trim();
    const { startsAt, endsAt } = resolvePlanPromoWindow(plan);
    const expired = isPlanPromoExpired(plan);

    rows.push({
      planId: plan.id,
      planName: plan.name,
      combinedCode: formatCombinedPromotionCode(base, suffix),
      promoLabel: plan.discount?.label?.trim() || base,
      generalDiscountDisplay: formatGeneralDiscountAmount(plan),
      affiliatePercent: Math.round(plan.affiliateDiscount!.value),
      startsAt,
      endsAt,
      validThrough: endsAt ? endsAt.slice(0, 10) : null,
      expired,
    });
  }

  return rows;
}

export function buildActiveAffiliateCombinedPromoRows(
  plans: PlanConfig[],
  promotionalCode: string,
): AffiliateCombinedPromoRow[] {
  return buildAffiliateCombinedPromoRows(plans, promotionalCode).filter((row) => {
    const plan = plans.find((p) => p.id === row.planId);
    return plan != null && isAffiliateDiscountEffectivelyActive(plan);
  });
}

export function buildExpiredAffiliateCombinedPromoRows(
  plans: PlanConfig[],
  promotionalCode: string,
): AffiliateCombinedPromoRow[] {
  return buildAffiliateCombinedPromoRows(plans, promotionalCode).filter((row) => row.expired);
}

export function groupExpiredAffiliatePromosByLabel(
  expiredRows: AffiliateCombinedPromoRow[],
): AffiliatePromoHistoryGroup[] {
  const map = new Map<string, AffiliatePromoHistoryGroup>();

  for (const row of expiredRows) {
    if (!row.startsAt || !row.endsAt) continue;
    const key = `${row.promoLabel}|${row.startsAt}|${row.endsAt}`;
    const existing = map.get(key);
    const item = {
      planName: row.planName,
      combinedCode: row.combinedCode,
      generalDiscountDisplay: row.generalDiscountDisplay,
      affiliatePercent: row.affiliatePercent,
    };
    if (existing) {
      existing.items.push(item);
    } else {
      map.set(key, {
        promoLabel: row.promoLabel,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        items: [item],
      });
    }
  }

  return [...map.values()].sort(
    (a, b) => parsePromoDateTimeMs(b.endsAt) - parsePromoDateTimeMs(a.endsAt),
  );
}
