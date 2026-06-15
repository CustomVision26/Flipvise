export const PRICING_BILLING_PERIODS = ["monthly", "yearly"] as const;
export type PricingBillingPeriod = (typeof PRICING_BILLING_PERIODS)[number];

export function parsePricingBillingPeriod(
  value: string | null | undefined,
): PricingBillingPeriod {
  return value === "yearly" ? "yearly" : "monthly";
}
