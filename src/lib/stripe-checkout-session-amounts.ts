import type Stripe from "stripe";
import { roundMajor } from "@/lib/money-math";

const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

function smallestUnitDivisor(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase()) ? 1 : 100;
}

function stripeMinorToMajor(
  minor: number | null | undefined,
  currency: string,
): number | null {
  if (minor == null) return null;
  return roundMajor(minor / smallestUnitDivisor(currency));
}

/** Major currency units from a Stripe Checkout Session (matches slide-button total). */
export type CheckoutSessionAmountsMajor = {
  subtotalMajor: number | null;
  discountMajor: number | null;
  taxMajor: number | null;
  totalDueMajor: number | null;
  currency: string;
};

/** Reads subtotal, discount, tax, and total from an open Checkout Session. */
export function checkoutSessionAmountsMajor(
  session: Stripe.Checkout.Session,
): CheckoutSessionAmountsMajor | null {
  const currency = session.currency?.toLowerCase() ?? "usd";
  const subtotalMajor = stripeMinorToMajor(session.amount_subtotal, currency);
  const totalDueMajor = stripeMinorToMajor(session.amount_total, currency);

  if (subtotalMajor == null && totalDueMajor == null) {
    return null;
  }

  const discountRaw = stripeMinorToMajor(
    session.total_details?.amount_discount ?? null,
    currency,
  );
  const taxRaw = stripeMinorToMajor(
    session.total_details?.amount_tax ?? null,
    currency,
  );

  return {
    subtotalMajor,
    discountMajor:
      discountRaw != null && discountRaw > 0 ? discountRaw : null,
    taxMajor: taxRaw != null && taxRaw > 0 ? taxRaw : null,
    totalDueMajor,
    currency,
  };
}
