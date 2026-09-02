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
import { usdPriceJmdCurrencyOptions } from "@/lib/stripe-jmd-currency";

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

async function retrievePriceOrNull(priceId: string): Promise<Stripe.Price | null> {
  try {
    return await stripe.prices.retrieve(priceId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (/no such price/i.test(message) || code === "resource_missing") return null;
    throw error;
  }
}

async function findActiveProductIdByMetadata(
  key: string,
  value: string,
): Promise<string | null> {
  for await (const product of stripe.products.list({ active: true, limit: 100 })) {
    if (product.metadata?.[key] === value) return product.id;
  }
  return null;
}

async function findActiveProductIdByName(name: string): Promise<string | null> {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  for await (const product of stripe.products.list({ active: true, limit: 100 })) {
    if (product.name.trim().toLowerCase() === needle) return product.id;
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
  nickname: string;
  period: "monthly" | "yearly";
  expectedMajor: number;
  currency: string;
}): Promise<string> {
  const recurring: Stripe.PriceCreateParams.Recurring =
    input.period === "yearly"
      ? { interval: "year", interval_count: 1 }
      : { interval: "month", interval_count: 1 };

  const unitAmount = majorToSmallestUnit(input.expectedMajor, input.currency);
  const created = await stripe.prices.create({
    product: input.productId,
    currency: input.currency,
    unit_amount: unitAmount,
    recurring,
    nickname: input.nickname,
    ...(input.currency.toLowerCase() === "usd"
      ? { currency_options: usdPriceJmdCurrencyOptions(unitAmount) }
      : {}),
  });
  return created.id;
}

/**
 * Find or create a recurring Price on the same product as `configuredPriceId`
 * whose per-cycle amount matches the catalog.
 *
 * If the env Price id was deleted (common after /admin/plans Save creates a new
 * Price), look up the product by metadata and use/create a matching Price.
 */
export async function ensureCatalogAlignedPriceId(input: {
  configuredPriceId: string;
  period: "monthly" | "yearly";
  monthlyPrice: number | null;
  yearlyMonthlyPrice: number | null;
  nickname: string;
  productMetadata?: { key: string; value: string };
  productName?: string;
}): Promise<string> {
  const expectedMajor = expectedCatalogBillingCycleMajor(input);
  if (expectedMajor == null || expectedMajor <= 0) {
    return input.configuredPriceId;
  }

  const configured = await retrievePriceOrNull(input.configuredPriceId);
  if (configured && priceMatchesCatalogMajor(configured, expectedMajor)) {
    return input.configuredPriceId;
  }

  let productId = configured ? productIdFromPrice(configured) : null;
  if (!productId && input.productMetadata) {
    productId = await findActiveProductIdByMetadata(
      input.productMetadata.key,
      input.productMetadata.value,
    );
  }
  if (!productId && input.productName) {
    productId = await findActiveProductIdByName(input.productName);
  }
  if (!productId) {
    throw new Error(
      `Stripe price ${input.configuredPriceId} was not found on this Stripe account. Update the matching STRIPE_*_PRICE_ID env var (Render live vs local test) to a Price that exists in the same mode as STRIPE_SECRET_KEY.`,
    );
  }

  const currency = configured?.currency ?? "usd";
  const existingId = await findCatalogPriceOnProduct({
    productId,
    period: input.period,
    expectedMajor,
    currency,
  });
  if (existingId) return existingId;

  return createCatalogPrice({
    productId,
    nickname: input.nickname,
    period: input.period,
    expectedMajor,
    currency,
  });
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
  productName?: string;
}): Promise<string> {
  const envPair = stripePriceEnvPairForPlan(input.plan, input.period);
  const configuredId = readStripePriceIdFromEnv(envPair);
  if (!configuredId) {
    throw new Error(
      `Missing Stripe price id env var ${envPair.primary} for plan: ${input.plan} (${input.period})`,
    );
  }

  return ensureCatalogAlignedPriceId({
    configuredPriceId: configuredId,
    period: input.period,
    monthlyPrice: input.monthlyPrice,
    yearlyMonthlyPrice: input.yearlyMonthlyPrice,
    nickname: `Flipvise ${input.plan} ${input.period} ($${expectedCatalogBillingCycleMajor(input) ?? "?"})`,
    productMetadata: { key: "flipvise_plan", value: input.plan },
    productName: input.productName,
  });
}
