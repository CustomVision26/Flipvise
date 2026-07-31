import { stripe } from "@/lib/stripe";
import { formatCurrencyFromCents } from "@/lib/format-currency";
import {
  resolveStripeAddonPriceIdFromEnvKey,
  type AddonBillingPeriod,
} from "@/lib/stripe-addon-price-env";

export type AddonStripePriceLabels = {
  monthlyLabel: string | null;
  yearlyLabel: string | null;
  monthlyConfigured: boolean;
  yearlyConfigured: boolean;
};

async function labelForPriceId(priceId: string | null): Promise<string | null> {
  if (!priceId) return null;
  try {
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active || price.unit_amount == null) return null;
    const amount = formatCurrencyFromCents(price.unit_amount, price.currency);
    const interval = price.recurring?.interval;
    if (interval === "year") return `${amount}/yr`;
    if (interval === "month") return `${amount}/mo`;
    return amount;
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
  const [monthlyLabel, yearlyLabel] = await Promise.all([
    labelForPriceId(monthlyId),
    labelForPriceId(yearlyId),
  ]);
  return {
    monthlyLabel,
    yearlyLabel,
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
