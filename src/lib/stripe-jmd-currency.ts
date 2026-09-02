import type Stripe from "stripe";

/**
 * Bank of Jamaica USD close on 2026-09-01 (J$ per US$1).
 * Override with STRIPE_JMD_PER_USD when creating or syncing prices.
 */
export const DEFAULT_JMD_PER_USD = 159.21;

export type StripeTaxBehavior = NonNullable<
  Stripe.PriceCreateParams.CurrencyOptions["tax_behavior"]
>;

export function jmdPerUsdFromEnv(): number {
  const raw = process.env.STRIPE_JMD_PER_USD?.trim();
  if (!raw) return DEFAULT_JMD_PER_USD;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Invalid STRIPE_JMD_PER_USD: ${raw}`);
  }
  return n;
}

/** Convert Stripe USD cents to JMD cents (both currencies have 2 decimal places). */
export function usdCentsToJmdCents(usdCents: number, jmdPerUsd: number): number {
  return Math.round(usdCents * jmdPerUsd);
}

export function jmdCurrencyOptionParams(
  usdCents: number,
  jmdPerUsd: number,
  taxBehavior: StripeTaxBehavior = "exclusive",
): Stripe.PriceCreateParams.CurrencyOptions {
  return {
    unit_amount: usdCentsToJmdCents(usdCents, jmdPerUsd),
    tax_behavior: taxBehavior === "unspecified" ? "exclusive" : taxBehavior,
  };
}

export function usdPriceJmdCurrencyOptions(
  usdCents: number,
  jmdPerUsd = jmdPerUsdFromEnv(),
): Stripe.PriceCreateParams["currency_options"] | undefined {
  if (usdCents <= 0) return undefined;
  return {
    jmd: jmdCurrencyOptionParams(usdCents, jmdPerUsd),
  };
}
