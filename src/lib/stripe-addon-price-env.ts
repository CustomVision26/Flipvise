import { readStripePriceIdFromEnv } from "@/lib/stripe-plan-price-env";

export type AddonBillingPeriod = "monthly" | "yearly";

const ADDON_PRICE_ENV_KEY_RE = /^STRIPE_ADDON_[A-Z0-9_]+_PRICE_ID$/;

/**
 * Resolves a Stripe Price id for an add-on from an env var name stored on the catalog row.
 * Example monthly: `STRIPE_ADDON_AI_ESSAY_PRICE_ID` → `price_…`
 * Yearly resolves `…_YEARLY_PRICE_ID` derived from the monthly catalog key.
 */
export function resolveStripeAddonPriceIdFromEnvKey(
  stripePriceEnvKey: string | null | undefined,
  period: AddonBillingPeriod = "monthly",
): string | null {
  const key = stripePriceEnvKey?.trim();
  if (!key) return null;
  if (!ADDON_PRICE_ENV_KEY_RE.test(key)) {
    return null;
  }
  if (period === "yearly") {
    const yearlyKey = key.replace(/_PRICE_ID$/, "_YEARLY_PRICE_ID");
    if (!ADDON_PRICE_ENV_KEY_RE.test(yearlyKey)) return null;
    return readStripePriceIdFromEnv({ primary: yearlyKey });
  }
  return readStripePriceIdFromEnv({ primary: key });
}

/** Canonical env key for a catalog add-on key (`ai_essay` → `STRIPE_ADDON_AI_ESSAY_PRICE_ID`). */
export function stripeAddonPriceEnvKeyForAddonKey(addonKey: string): string {
  const normalized = addonKey
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `STRIPE_ADDON_${normalized}_PRICE_ID`;
}

/** Yearly companion env key (`STRIPE_ADDON_AI_ESSAY_PRICE_ID` → `STRIPE_ADDON_AI_ESSAY_YEARLY_PRICE_ID`). */
export function stripeAddonYearlyPriceEnvKeyFromMonthly(
  stripePriceEnvKey: string | null | undefined,
): string | null {
  const key = stripePriceEnvKey?.trim();
  if (!key || !ADDON_PRICE_ENV_KEY_RE.test(key)) return null;
  return key.replace(/_PRICE_ID$/, "_YEARLY_PRICE_ID");
}
