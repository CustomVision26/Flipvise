import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { formatCurrencyFromCents } from "@/lib/format-currency";
import { roundMajor } from "@/lib/money-math";
import {
  majorPerBillingCycleFromSubscriptionPrice,
} from "@/lib/stripe-pricing-display";
import {
  resolveStripeAddonPriceIdFromEnvKey,
  type AddonBillingPeriod,
} from "@/lib/stripe-addon-price-env";

export type AddonStripePriceLabels = {
  /** e.g. "$8.99/mo" — charged each month */
  monthlyLabel: string | null;
  /**
   * Actual amount charged for a year of the add-on, e.g. "$95.88/yr".
   * Prefer this for the yearly hero price (not a monthly-equivalent).
   */
  yearlyLabel: string | null;
  /** Effective monthly rate when paying yearly, e.g. "$7.99/mo" */
  yearlyMonthlyEquivalentLabel: string | null;
  monthlyConfigured: boolean;
  yearlyConfigured: boolean;
};

function monthsPerBillingCycle(rec: Stripe.Price.Recurring): number {
  const n = rec.interval_count ?? 1;
  switch (rec.interval) {
    case "month":
      return n;
    case "year":
      return 12 * n;
    case "week":
      return (n * 7) / (365 / 12);
    case "day":
      return n / (365 / 12);
    default:
      return 1;
  }
}

function formatMajor(amount: number, currency: string): string {
  const cents = Math.round(amount * 100);
  return formatCurrencyFromCents(cents, currency);
}

/**
 * Resolve the real annual charge for a yearly Stripe price (what Checkout bills
 * for one year of the add-on).
 *
 * - `interval: year` (×1) → `unit_amount` is the yearly charge
 * - `interval: month` (×12) → `unit_amount` is the yearly charge
 * - `interval: month` (×1) on a yearly price id → annualize × 12
 */
function annualChargeMajor(yearlyPrice: Stripe.Price): number | null {
  const perCycle = majorPerBillingCycleFromSubscriptionPrice(yearlyPrice);
  if (perCycle == null) return null;
  const rec = yearlyPrice.recurring;
  if (!rec) return perCycle;

  const months = monthsPerBillingCycle(rec);
  if (!Number.isFinite(months) || months <= 0) return perCycle;

  return roundMajor(perCycle * (12 / months));
}

async function retrievePrice(priceId: string): Promise<Stripe.Price | null> {
  try {
    return await stripe.prices.retrieve(priceId, {
      expand: ["currency_options", "tiers"],
    });
  } catch (error) {
    console.error("[addonStripePriceLabels] retrieve failed:", priceId, error);
    return null;
  }
}

/** Resolve display labels for an add-on's monthly/yearly Stripe prices from env keys. */
export async function resolveAddonStripePriceLabels(
  stripePriceEnvKey: string | null | undefined,
): Promise<AddonStripePriceLabels> {
  const monthlyId = resolveStripeAddonPriceIdFromEnvKey(
    stripePriceEnvKey,
    "monthly",
  );
  const yearlyId = resolveStripeAddonPriceIdFromEnvKey(
    stripePriceEnvKey,
    "yearly",
  );

  const [monthlyPrice, yearlyPrice] = await Promise.all([
    monthlyId ? retrievePrice(monthlyId) : Promise.resolve(null),
    yearlyId ? retrievePrice(yearlyId) : Promise.resolve(null),
  ]);

  let monthlyLabel: string | null = null;
  if (monthlyPrice?.active) {
    const monthlyCharge =
      majorPerBillingCycleFromSubscriptionPrice(monthlyPrice);
    if (monthlyCharge != null) {
      monthlyLabel = `${formatMajor(monthlyCharge, monthlyPrice.currency)}/mo`;
    }
  }

  let yearlyLabel: string | null = null;
  let yearlyMonthlyEquivalentLabel: string | null = null;
  if (yearlyPrice?.active) {
    const annual = annualChargeMajor(yearlyPrice);
    if (annual != null) {
      yearlyLabel = `${formatMajor(annual, yearlyPrice.currency)}/yr`;
      yearlyMonthlyEquivalentLabel = `${formatMajor(
        roundMajor(annual / 12),
        yearlyPrice.currency,
      )}/mo`;
    }
  }

  return {
    monthlyLabel,
    yearlyLabel,
    yearlyMonthlyEquivalentLabel,
    monthlyConfigured: Boolean(monthlyId),
    yearlyConfigured: Boolean(yearlyId),
  };
}

export async function resolveAddonStripePriceLabelsForPeriod(
  stripePriceEnvKey: string | null | undefined,
  period: AddonBillingPeriod,
): Promise<string | null> {
  const labels = await resolveAddonStripePriceLabels(stripePriceEnvKey);
  return period === "yearly" ? labels.yearlyLabel : labels.monthlyLabel;
}
