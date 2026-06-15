import type Stripe from "stripe";
import type { StripePaidPlanId } from "@/lib/billing-plan-ids";
import { stripe } from "@/lib/stripe";
import {
  majorPerBillingCycleFromSubscriptionPrice,
  roundMajor,
} from "@/lib/stripe-pricing-display";
import {
  readStripePriceIdFromEnv,
  stripePriceEnvPairForPlan,
} from "@/lib/stripe-plan-price-env";

const CATALOG_STRIPE_PRICE_TOLERANCE = 0.02;

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

function majorToSmallestUnit(major: number, currency: string): number {
  return Math.round(major * smallestUnitDivisor(currency));
}

export function expectedCatalogBillingCycleMajor(input: {
  period: "monthly" | "yearly";
  monthlyPrice: number | null;
  yearlyMonthlyPrice: number | null;
}): number | null {
  if (input.period === "yearly") {
    return input.yearlyMonthlyPrice != null
      ? roundMajor(input.yearlyMonthlyPrice * 12)
      : null;
  }
  return input.monthlyPrice;
}

function priceMatchesCatalogMajor(
  price: Stripe.Price,
  expectedMajor: number,
): boolean {
  const actualMajor = majorPerBillingCycleFromSubscriptionPrice(price);
  if (actualMajor == null || expectedMajor <= 0) return false;
  return (
    Math.abs(actualMajor - expectedMajor) / expectedMajor <=
    CATALOG_STRIPE_PRICE_TOLERANCE
  );
}

function recurringMatchesPeriod(
  recurring: Stripe.Price.Recurring,
  period: "monthly" | "yearly",
): boolean {
  const count = recurring.interval_count ?? 1;
  if (period === "monthly") {
    return recurring.interval === "month" && count === 1;
  }
  return (
    (recurring.interval === "year" && count === 1) ||
    (recurring.interval === "month" && count === 12)
  );
}

function productIdFromPrice(price: Stripe.Price): string | null {
  const product = price.product;
  if (typeof product === "string") return product;
  if (product && typeof product === "object" && "id" in product) {
    return product.id;
  }
  return null;
}

async function listActivePricesForProduct(
  productId: string,
): Promise<Stripe.Price[]> {
  const prices: Stripe.Price[] = [];
  let startingAfter: string | undefined;

  do {
    const page = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    prices.push(...page.data);
    startingAfter = page.has_more ? page.data.at(-1)?.id : undefined;
  } while (startingAfter);

  return prices;
}

async function findCatalogPriceOnProduct(input: {
  productId: string;
  period: "monthly" | "yearly";
  expectedMajor: number;
  currency: string;
}): Promise<string | null> {
  const prices = await listActivePricesForProduct(input.productId);
  for (const price of prices) {
    if (!price.recurring || price.currency !== input.currency) continue;
    if (!recurringMatchesPeriod(price.recurring, input.period)) continue;
    if (!priceMatchesCatalogMajor(price, input.expectedMajor)) continue;
    return price.id;
  }
  return null;
}

async function createCatalogPrice(input: {
  productId: string;
  plan: StripePaidPlanId;
  period: "monthly" | "yearly";
  expectedMajor: number;
  currency: string;
}): Promise<string> {
  const recurring: Stripe.PriceCreateParams.Recurring =
    input.period === "yearly"
      ? { interval: "year", interval_count: 1 }
      : { interval: "month", interval_count: 1 };

  const created = await stripe.prices.create({
    product: input.productId,
    currency: input.currency,
    unit_amount: majorToSmallestUnit(input.expectedMajor, input.currency),
    recurring,
    nickname: `Flipvise ${input.plan} ${input.period} ($${input.expectedMajor})`,
  });
  return created.id;
}

/**
 * Returns a Stripe Price id whose per-cycle amount matches the plans catalog.
 * When the env-configured price is wrong (e.g. $10/year instead of $120/year),
 * finds or creates a matching price on the same product.
 */
export async function resolveCatalogAlignedStripePriceId(input: {
  plan: StripePaidPlanId;
  period: "monthly" | "yearly";
  monthlyPrice: number | null;
  yearlyMonthlyPrice: number | null;
}): Promise<string> {
  const envPair = stripePriceEnvPairForPlan(input.plan, input.period);
  const configuredId = readStripePriceIdFromEnv(envPair);
  if (!configuredId) {
    throw new Error(
      `Missing Stripe price id env var ${envPair.primary} for plan: ${input.plan} (${input.period})`,
    );
  }

  const expectedMajor = expectedCatalogBillingCycleMajor(input);
  if (expectedMajor == null || expectedMajor <= 0) {
    return configuredId;
  }

  const configured = await stripe.prices.retrieve(configuredId);
  if (priceMatchesCatalogMajor(configured, expectedMajor)) {
    return configuredId;
  }

  const productId = productIdFromPrice(configured);
  if (!productId) {
    return configuredId;
  }

  const currency = configured.currency;
  const existingId = await findCatalogPriceOnProduct({
    productId,
    period: input.period,
    expectedMajor,
    currency,
  });
  if (existingId) {
    const actualMajor = majorPerBillingCycleFromSubscriptionPrice(configured);
    console.warn(
      `[stripe-catalog-price] ${envPair.primary}=${configuredId} ($${actualMajor ?? "?"}) does not match catalog $${expectedMajor}. Using existing price ${existingId}. Update env when convenient.`,
    );
    return existingId;
  }

  const createdId = await createCatalogPrice({
    productId,
    plan: input.plan,
    period: input.period,
    expectedMajor,
    currency,
  });
  const actualMajor = majorPerBillingCycleFromSubscriptionPrice(configured);
  console.warn(
    `[stripe-catalog-price] ${envPair.primary}=${configuredId} ($${actualMajor ?? "?"}) does not match catalog $${expectedMajor}. Created ${createdId}. Set ${envPair.primary}=${createdId} in env.`,
  );
  return createdId;
}
