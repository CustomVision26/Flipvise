import Stripe from "stripe";

const stripeSecretKeyRaw = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKeyRaw) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}
const stripeSecretKey: string = stripeSecretKeyRaw;

function stripeKeyMode(value: string): "test" | "live" | "unknown" {
  if (value.startsWith("sk_test_") || value.startsWith("pk_test_")) return "test";
  if (value.startsWith("sk_live_") || value.startsWith("pk_live_")) return "live";
  return "unknown";
}

function validateStripeEnv(): void {
  const secretMode = stripeKeyMode(stripeSecretKey);
  if (secretMode === "unknown") {
    throw new Error(
      `Invalid STRIPE_SECRET_KEY format: expected key starting with "sk_test_" or "sk_live_".`,
    );
  }

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  if (publishableKey) {
    const publishableMode = stripeKeyMode(publishableKey);
    if (publishableMode === "unknown") {
      throw new Error(
        `Invalid NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY format: expected key starting with "pk_test_" or "pk_live_".`,
      );
    }
    if (publishableMode !== secretMode) {
      throw new Error(
        `Stripe key mode mismatch: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is "${publishableMode}" but STRIPE_SECRET_KEY is "${secretMode}".`,
      );
    }
  }

  // Price IDs (`STRIPE_*_PRICE_ID`) are validated when Checkout runs — not here — so the app can
  // boot with canonical `STRIPE_PRO_PLUS_*` vars without legacy `STRIPE_PRO_TEAM_*` aliases filled in.
}

validateStripeEnv();

/** Pinned to the version bundled with the installed `stripe` package (`stripe/esm/apiVersion.d.ts`). */
export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2026-04-22.dahlia",
  /** Pricing page retrieves many Prices; allow slow networks without silent timeouts. */
  timeout: 25_000,
  maxNetworkRetries: 2,
});

export function resolveAppUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "");
  }
  return "http://localhost:3000";
}
