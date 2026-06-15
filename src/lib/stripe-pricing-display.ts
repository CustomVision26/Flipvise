import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { roundMajor } from "@/lib/money-math";
import {
  isStripePaidPlanId,
  STRIPE_PAID_PLAN_IDS,
  type StripePaidPlanId,
} from "@/lib/billing-plan-ids";
import { resolveStripePriceIdForPlan } from "@/lib/stripe-plan-price-env";

export type PlanStripePriceDisplay = {
  /** Monthly recurring amount in major currency units (e.g. USD dollars). */
  monthlyMajor: number | null;
  /** Effective monthly cost when paying yearly (yearly total ÷ 12). */
  yearlyMonthlyEquivalentMajor: number | null;
  /** ISO currency code from Stripe (lowercase). */
  currency: string | null;
};

export { roundMajor } from "@/lib/money-math";

/** ISO 4217 currencies where Stripe amounts are already in whole major units. */
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

type CurrencyOptionRow = {
  unit_amount?: number | null;
  unit_amount_decimal?: string | null;
};

/**
 * Resolves per-unit amounts from a Price. Handles:
 * - Multi-currency (`currency_options[currency]`, expanded on retrieve)
 * - Tiered `billing_scheme` (first tier as display hint)
 * - Standard `per_unit` root fields
 */
function perUnitSmallestAmount(price: Stripe.Price): {
  smallest: number | null;
  currency: string | null;
} {
  const currency = price.currency?.toLowerCase() ?? null;
  if (!currency) return { smallest: null, currency: null };

  const withOpts = price as Stripe.Price & {
    currency_options?: Record<string, CurrencyOptionRow> | null;
  };
  const optRow = withOpts.currency_options?.[currency];

  let ua: number | null | undefined;
  let uad: string | null | undefined;

  if (optRow && (optRow.unit_amount != null || optRow.unit_amount_decimal)) {
    ua = optRow.unit_amount ?? undefined;
    uad =
      optRow.unit_amount_decimal != null
        ? String(optRow.unit_amount_decimal)
        : undefined;
  } else if (price.billing_scheme === "tiered" && price.tiers?.length) {
    const t = price.tiers[0];
    ua = t.unit_amount ?? undefined;
    uad =
      t.unit_amount_decimal != null
        ? String(t.unit_amount_decimal)
        : undefined;
  } else {
    ua = price.unit_amount ?? undefined;
    uad =
      price.unit_amount_decimal != null
        ? String(price.unit_amount_decimal)
        : undefined;
  }

  if (typeof ua === "number") {
    return { smallest: ua, currency };
  }
  if (uad != null && String(uad).trim() !== "") {
    const n = Number.parseFloat(String(uad));
    if (!Number.isFinite(n)) return { smallest: null, currency };
    return { smallest: n, currency };
  }
  return { smallest: null, currency };
}

/** Stripe amounts are in the smallest currency unit (e.g. cents); convert to major units for UI. */
function majorCurrencyAmount(price: Stripe.Price): number | null {
  const { smallest, currency } = perUnitSmallestAmount(price);
  if (smallest == null || !currency) return null;
  const divisor = smallestUnitDivisor(currency);
  return roundMajor(smallest / divisor);
}

/**
 * Stripe charges `unit_amount` once per billing cycle (`interval` × `interval_count`).
 * Convert that to an average major-unit amount per month for the pricing UI.
 *
 * Examples:
 * - month × 1 → per-cycle amount is already monthly.
 * - year × 1 → per-cycle amount is annual → ÷ 12.
 * - month × 12 → billed once per year with an annual total → ÷ 12 (fixes incorrect Annual toggle).
 */
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

/** Amount charged once per billing cycle (e.g. $120/year or $15/month). */
export function majorPerBillingCycleFromSubscriptionPrice(
  price: Stripe.Price,
): number | null {
  return majorCurrencyAmount(price);
}

/** Average $/month for a subscription Price (monthly + yearly env IDs both use this). */
function majorPerMonthFromSubscriptionPrice(price: Stripe.Price): number | null {
  const perCycle = majorCurrencyAmount(price);
  if (perCycle == null || !price.currency) return null;
  const rec = price.recurring;
  if (!rec) return perCycle;
  const months = monthsPerBillingCycle(rec);
  if (!Number.isFinite(months) || months <= 0) return null;
  return roundMajor(perCycle / months);
}

async function retrievePrice(priceId: string): Promise<Stripe.Price> {
  return stripe.prices.retrieve(priceId, {
    expand: ["currency_options", "tiers"],
  });
}

/**
 * Loads unit amounts from Stripe for each configured price id env var.
 * Used so the pricing page matches Checkout line items.
 *
 * Fetches run sequentially to avoid burst limits.
 */
export async function fetchStripePricingForPaidPlans(): Promise<
  Partial<Record<StripePaidPlanId, PlanStripePriceDisplay>>
> {
  try {
    const out: Partial<Record<StripePaidPlanId, PlanStripePriceDisplay>> = {};

    for (const plan of STRIPE_PAID_PLAN_IDS) {
      const monthlyId = resolveStripePriceIdForPlan(plan, "monthly");
      const yearlyId = resolveStripePriceIdForPlan(plan, "yearly");

      let monthlyMajor: number | null = null;
      let yearlyMonthlyEquivalentMajor: number | null = null;
      let currency: string | null = null;

      try {
        if (monthlyId) {
          const p = await retrievePrice(monthlyId);
          monthlyMajor = majorPerMonthFromSubscriptionPrice(p);
          if (p.currency) currency = p.currency;
        }
      } catch {
        // Wrong account/mode, invalid id, network — fall back to JSON for this slot
      }

      try {
        if (yearlyId) {
          const p = await retrievePrice(yearlyId);
          yearlyMonthlyEquivalentMajor =
            majorPerMonthFromSubscriptionPrice(p);
          if (!currency && p.currency) currency = p.currency;
        }
      } catch {
        // Same fallback
      }

      if (
        monthlyMajor !== null ||
        yearlyMonthlyEquivalentMajor !== null ||
        currency !== null
      ) {
        out[plan] = {
          monthlyMajor,
          yearlyMonthlyEquivalentMajor,
          currency,
        };
      }
    }

    return out;
  } catch {
    return {};
  }
}

const CATALOG_STRIPE_PRICE_TOLERANCE = 0.02;

export class CatalogStripePriceMismatchError extends Error {
  readonly plan: StripePaidPlanId;
  readonly period: "monthly" | "yearly";
  readonly expectedMajor: number;
  readonly actualMajor: number;
  readonly priceId: string;

  constructor(input: {
    plan: StripePaidPlanId;
    period: "monthly" | "yearly";
    expectedMajor: number;
    actualMajor: number;
    priceId: string;
  }) {
    super(
      `Catalog ${input.period} price for ${input.plan} ($${input.expectedMajor}) does not match Stripe price ${input.priceId} ($${input.actualMajor}).`,
    );
    this.name = "CatalogStripePriceMismatchError";
    this.plan = input.plan;
    this.period = input.period;
    this.expectedMajor = input.expectedMajor;
    this.actualMajor = input.actualMajor;
    this.priceId = input.priceId;
  }
}

/** Ensures Stripe checkout line items match catalog amounts before redirecting. */
export async function validateStripePriceMatchesCatalog(input: {
  plan: StripePaidPlanId;
  period: "monthly" | "yearly";
  monthlyPrice: number | null;
  yearlyMonthlyPrice: number | null;
}): Promise<void> {
  const priceId = resolveStripePriceIdForPlan(input.plan, input.period);
  if (!priceId) return;

  const stripePrice = await retrievePrice(priceId);
  const actualMajor = majorPerBillingCycleFromSubscriptionPrice(stripePrice);
  if (actualMajor == null) return;

  const expectedMajor =
    input.period === "yearly"
      ? input.yearlyMonthlyPrice != null
        ? roundMajor(input.yearlyMonthlyPrice * 12)
        : null
      : input.monthlyPrice;

  if (expectedMajor == null || expectedMajor <= 0) return;

  const relativeDelta = Math.abs(actualMajor - expectedMajor) / expectedMajor;
  if (relativeDelta <= CATALOG_STRIPE_PRICE_TOLERANCE) return;

  throw new CatalogStripePriceMismatchError({
    plan: input.plan,
    period: input.period,
    expectedMajor,
    actualMajor,
    priceId,
  });
}

export function mergePlansConfigWithStripePricing<
  T extends {
    id: string;
    monthlyPrice: number | null;
    yearlyMonthlyPrice: number | null;
  },
>(
  plans: T[],
  stripePartial: Partial<Record<StripePaidPlanId, PlanStripePriceDisplay>>,
): T[] {
  return plans.map((plan) => {
    if (plan.id === "free") return plan;
    if (!isStripePaidPlanId(plan.id)) return plan;
    const s = stripePartial[plan.id];
    if (!s) return plan;

    return {
      ...plan,
      /**
       * `plans-config.json` (edited in `/admin/plans`) is the marketing source of truth for
       * display prices. Stripe fills gaps only when catalog omits an amount (`null`).
       * Checkout validates Stripe line items against catalog before redirecting.
       */
      monthlyPrice:
        plan.monthlyPrice != null
          ? plan.monthlyPrice
          : (s.monthlyMajor ?? plan.monthlyPrice),
      yearlyMonthlyPrice:
        plan.yearlyMonthlyPrice != null
          ? plan.yearlyMonthlyPrice
          : (s.yearlyMonthlyEquivalentMajor ?? plan.yearlyMonthlyPrice),
    };
  });
}
