import type { PlanConfig } from "@/lib/plan-config-types";
import { isGeneralDiscountEffectivelyActive } from "@/lib/plan-promo-window";
import { applyDiscount } from "@/lib/plan-pricing";
import type { PricingBillingPeriod } from "@/lib/pricing-billing-period";

export function formatPlanMoney(amount: number): string {
  return String(Math.round(amount * 100) / 100);
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export type PlanPeriodPricing = {
  period: PricingBillingPeriod;
  basePeriodicRate: number;
  discountedPeriodicRate: number;
  baseAnnualTotal: number | null;
  discountedAnnualTotal: number | null;
  hasActiveDiscount: boolean;
};

/**
 * Catalog amounts for a plan + billing period.
 * Yearly uses `yearlyMonthlyPrice` as the per-month rate when billed annually;
 * `discountedAnnualTotal` is that rate × 12 (what Stripe yearly prices should charge pre-coupon).
 */
export function computePlanPeriodPricing(
  plan: Pick<PlanConfig, "monthlyPrice" | "yearlyMonthlyPrice" | "discount"> &
    Parameters<typeof isGeneralDiscountEffectivelyActive>[0],
  period: PricingBillingPeriod,
): PlanPeriodPricing | null {
  const basePeriodicRate =
    period === "monthly" ? plan.monthlyPrice : plan.yearlyMonthlyPrice;
  if (basePeriodicRate == null) return null;

  const hasActiveDiscount =
    isGeneralDiscountEffectivelyActive(plan) && plan.discount != null;
  const discountedPeriodicRate =
    hasActiveDiscount && plan.discount
      ? applyDiscount(basePeriodicRate, plan.discount)
      : basePeriodicRate;

  const baseAnnualTotal =
    period === "yearly" ? roundMoney(basePeriodicRate * 12) : null;
  const discountedAnnualTotal =
    period === "yearly" ? roundMoney(discountedPeriodicRate * 12) : null;

  return {
    period,
    basePeriodicRate,
    discountedPeriodicRate,
    baseAnnualTotal,
    discountedAnnualTotal,
    hasActiveDiscount,
  };
}
