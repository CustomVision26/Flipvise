import type { PlanConfig } from "@/components/pricing-content";
import { formatCombinedPromotionCode } from "@/lib/affiliate-promotional-code";

export type AffiliateCombinedPromoRow = {
  planId: string;
  planName: string;
  combinedCode: string;
  affiliatePercent: number;
  /** ISO date (YYYY-MM-DD) when checkout codes stop redeeming, if configured. */
  validThrough: string | null;
};

/** Per-tier combined checkout codes an affiliate can share (matches admin broadcast hints). */
export function buildAffiliateCombinedPromoRows(
  plans: PlanConfig[],
  promotionalCode: string,
): AffiliateCombinedPromoRow[] {
  const suffix = promotionalCode.trim().toLowerCase();
  const rows: AffiliateCombinedPromoRow[] = [];

  for (const plan of plans) {
    if (plan.id === "free") continue;
    const base = plan.discount?.stripeCouponId?.trim();
    const aff = plan.affiliateDiscount;
    if (!base || !aff?.active || !(aff.value > 0)) continue;

    rows.push({
      planId: plan.id,
      planName: plan.name,
      combinedCode: formatCombinedPromotionCode(base, suffix),
      affiliatePercent: Math.round(aff.value),
      validThrough: plan.discontinueAt?.trim() || null,
    });
  }

  return rows;
}
