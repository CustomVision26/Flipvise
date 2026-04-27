import Stripe from "stripe";

const stripeSecretKeyRaw = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKeyRaw) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}
const stripeSecretKey: string = stripeSecretKeyRaw;

const STRIPE_PRICE_ENV_VARS = [
  "STRIPE_PRO_PRICE_ID",
  "STRIPE_PRO_TEAM_BASIC_PRICE_ID",
  "STRIPE_PRO_TEAM_GOLD_PRICE_ID",
  "STRIPE_PRO_PLATINUM_PLAN_PRICE_ID",
  "STRIPE_PRO_ENTERPRISE_PRICE_ID",
] as const;

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

  for (const envVar of STRIPE_PRICE_ENV_VARS) {
    const value = process.env[envVar]?.trim();
    if (!value) {
      throw new Error(`Missing Stripe price env var: ${envVar}.`);
    }
    if (!value.startsWith("price_")) {
      throw new Error(
        `Invalid ${envVar}: expected Stripe Price ID starting with "price_" but got "${value}".`,
      );
    }
  }
}

validateStripeEnv();

/** Pinned to the version bundled with the installed `stripe` package (`stripe/esm/apiVersion.d.ts`). */
export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2026-04-22.dahlia",
});

export function resolveAppUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "");
  }
  return "http://localhost:3000";
}
