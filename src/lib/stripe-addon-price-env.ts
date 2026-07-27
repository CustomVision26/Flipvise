import { readStripePriceIdFromEnv } from "@/lib/stripe-plan-price-env";

/**
 * Resolves a Stripe monthly Price id for an add-on from an env var name stored on the catalog row.
 * Example: `STRIPE_ADDON_STUDY_MODE_FOCUS_PRICE_ID` → `price_…`
 */
export function resolveStripeAddonPriceIdFromEnvKey(
  stripePriceEnvKey: string | null | undefined,
): string | null {
  const key = stripePriceEnvKey?.trim();
  if (!key) return null;
  if (!/^STRIPE_ADDON_[A-Z0-9_]+_PRICE_ID$/.test(key)) {
    return null;
  }
  return readStripePriceIdFromEnv({ primary: key });
}

/** Canonical env key for a catalog add-on key (`study_mode_focus` → `STRIPE_ADDON_STUDY_MODE_FOCUS_PRICE_ID`). */
export function stripeAddonPriceEnvKeyForAddonKey(addonKey: string): string {
  const normalized = addonKey
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `STRIPE_ADDON_${normalized}_PRICE_ID`;
}
