/**
 * Create or reuse Stripe products + monthly/yearly prices for every paid plan
 * in plans-config.json. Yearly Stripe amount is yearlyMonthlyPrice × 12 (billed once per year).
 *
 * Usage:
 *   npx tsx scripts/sync-stripe-plan-prices.ts
 *   npx tsx scripts/sync-stripe-plan-prices.ts --live
 *
 * `--live` is required when STRIPE_SECRET_KEY is sk_live_*.
 * Does not write env files — print the Render vars and paste them yourself.
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import Stripe from "stripe";
import type { PlanConfig } from "@/lib/plan-config-types";
import { isStripePaidPlanId, type StripePaidPlanId } from "@/lib/billing-plan-ids";
import { stripePriceEnvPairForPlan } from "@/lib/stripe-plan-price-env";

const liveFlag = process.argv.includes("--live");
const envFileIdx = process.argv.indexOf("--env-file");
const envFile = envFileIdx >= 0 ? process.argv[envFileIdx + 1] : null;
if (envFile) {
  config({ path: resolve(process.cwd(), envFile), override: true });
} else {
  config({ path: resolve(process.cwd(), ".env") });
  config({ path: resolve(process.cwd(), ".env.local"), override: true });
}

type PlanSyncSpec = {
  plan: StripePaidPlanId;
  name: string;
  description: string;
  features: string[];
  monthlyCents: number;
  yearlyCents: number;
  monthlyEnv: string;
  yearlyEnv: string;
};

function requireSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (key.startsWith("sk_live_") && !liveFlag) {
    throw new Error(
      "Refusing to mutate live Stripe without --live. Re-run with: npx tsx scripts/sync-stripe-plan-prices.ts --live",
    );
  }
  if (key.startsWith("sk_test_") && liveFlag) {
    throw new Error(
      "STRIPE_SECRET_KEY is a test key. For live, point STRIPE_SECRET_KEY at sk_live_* then pass --live.",
    );
  }
  return key;
}

function loadPaidPlans(): PlanSyncSpec[] {
  const raw = readFileSync(
    resolve(process.cwd(), "src", "data", "plans-config.json"),
    "utf8",
  );
  const plans = JSON.parse(raw) as PlanConfig[];
  const specs: PlanSyncSpec[] = [];
  for (const plan of plans) {
    if (!isStripePaidPlanId(plan.id)) continue;
    if (plan.monthlyPrice == null || plan.yearlyMonthlyPrice == null) continue;
    const monthlyEnv = stripePriceEnvPairForPlan(plan.id, "monthly").primary;
    const yearlyEnv = stripePriceEnvPairForPlan(plan.id, "yearly").primary;
    specs.push({
      plan: plan.id,
      name: plan.name,
      description: plan.description,
      features: plan.features,
      monthlyCents: Math.round(plan.monthlyPrice * 100),
      yearlyCents: Math.round(plan.yearlyMonthlyPrice * 12 * 100),
      monthlyEnv,
      yearlyEnv,
    });
  }
  return specs;
}

async function listAllProducts(stripe: Stripe): Promise<Stripe.Product[]> {
  const products: Stripe.Product[] = [];
  for await (const product of stripe.products.list({ limit: 100 })) {
    products.push(product);
  }
  return products;
}

function pickProduct(
  products: Stripe.Product[],
  spec: PlanSyncSpec,
): Stripe.Product | null {
  const tagged = products.filter(
    (p) => p.active && p.metadata?.flipvise_plan === spec.plan,
  );
  if (tagged.length > 0) {
    tagged.sort((a, b) => a.created - b.created);
    return tagged[0]!;
  }
  const named = products.filter(
    (p) => p.active && p.name.trim().toLowerCase() === spec.name.trim().toLowerCase(),
  );
  if (named.length > 0) {
    named.sort((a, b) => a.created - b.created);
    return named[0]!;
  }
  return null;
}

async function ensureProduct(
  stripe: Stripe,
  spec: PlanSyncSpec,
  existing: Stripe.Product | null,
): Promise<Stripe.Product> {
  const marketingFeatures = spec.features.slice(0, 15).map((name) => ({ name }));
  const payload = {
    name: spec.name,
    description: spec.description,
    metadata: {
      flipvise_plan: spec.plan,
      type: "plan",
    },
    marketing_features: marketingFeatures,
  };

  if (!existing) {
    return stripe.products.create(payload);
  }

  return stripe.products.update(existing.id, {
    ...payload,
    active: true,
  });
}

function isWrongYearlyBugPrice(price: Stripe.Price, spec: PlanSyncSpec): boolean {
  const yearlyMonthlyCents = Math.round(spec.yearlyCents / 12);
  return (
    price.recurring?.interval === "year" &&
    price.unit_amount === yearlyMonthlyCents &&
    price.currency === "usd"
  );
}

async function findOrCreatePrice(
  stripe: Stripe,
  productId: string,
  interval: "month" | "year",
  unitAmount: number,
  spec: PlanSyncSpec,
): Promise<Stripe.Price> {
  const listed = await stripe.prices.list({
    product: productId,
    active: true,
    type: "recurring",
    limit: 100,
  });
  const match = listed.data.find(
    (p) =>
      p.recurring?.interval === interval &&
      (p.recurring.interval_count ?? 1) === 1 &&
      p.unit_amount === unitAmount &&
      p.currency === "usd",
  );
  if (match) return match;

  return stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: unitAmount,
    recurring: { interval, interval_count: 1 },
    nickname: `Flipvise ${spec.plan} ${interval === "month" ? "monthly" : "yearly"} ($${(unitAmount / 100).toFixed(0)})`,
    metadata: {
      type: "plan",
      plan: spec.plan,
      period: interval === "month" ? "monthly" : "yearly",
    },
  });
}

async function archiveWrongYearlyPrices(
  stripe: Stripe,
  productId: string,
  spec: PlanSyncSpec,
  keepPriceId: string,
): Promise<void> {
  const listed = await stripe.prices.list({
    product: productId,
    active: true,
    type: "recurring",
    limit: 100,
  });
  for (const price of listed.data) {
    if (price.id === keepPriceId) continue;
    if (!isWrongYearlyBugPrice(price, spec)) continue;
    await stripe.prices.update(price.id, { active: false });
    console.log(
      `  archived wrong yearly price ${price.id} ($${(price.unit_amount ?? 0) / 100}/year)`,
    );
  }
}

async function main() {
  const secret = requireSecretKey();
  const stripe = new Stripe(secret, { apiVersion: "2026-04-22.dahlia" });
  const mode = secret.startsWith("sk_live_") ? "live" : "test";
  const specs = loadPaidPlans();

  console.log(`\n=== Sync Flipvise plan products (${mode}) ===\n`);

  const products = await listAllProducts(stripe);
  const envLines: string[] = [];

  for (const spec of specs) {
    const yearlyMajor = spec.yearlyCents / 100;
    const monthlyMajor = spec.monthlyCents / 100;
    console.log(
      `${spec.name} (${spec.plan}): $${monthlyMajor}/month · $${yearlyMajor}/year`,
    );

    const picked = pickProduct(products, spec);
    const product = await ensureProduct(stripe, spec, picked);
    if (!picked) {
      products.push(product);
      console.log(`  created product ${product.id}`);
    } else {
      console.log(`  using product ${product.id}`);
    }

    const monthly = await findOrCreatePrice(
      stripe,
      product.id,
      "month",
      spec.monthlyCents,
      spec,
    );
    const yearly = await findOrCreatePrice(
      stripe,
      product.id,
      "year",
      spec.yearlyCents,
      spec,
    );
    await archiveWrongYearlyPrices(stripe, product.id, spec, yearly.id);
    await stripe.products.update(product.id, { default_price: monthly.id });

    console.log(`  ${spec.monthlyEnv}=${monthly.id}`);
    console.log(`  ${spec.yearlyEnv}=${yearly.id}`);
    envLines.push(`${spec.monthlyEnv}=${monthly.id}`);
    envLines.push(`${spec.yearlyEnv}=${yearly.id}`);
  }

  console.log("\n--- Paste into Render (live) Environment ---\n");
  console.log(envLines.join("\n"));
  console.log("");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
