/**
 * Archive the retired Focus Study Mode Stripe product (deactivate prices,
 * cancel add-on-only subscriptions, hide the product). Does not delete
 * historical invoices.
 *
 * Usage:
 *   npx tsx scripts/archive-stripe-focus-study-addon.ts
 *   npx tsx scripts/archive-stripe-focus-study-addon.ts --live --env-file .env.old
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import type Stripe from "stripe";

const ADDON_KEY = "study_mode_focus";
const liveFlag = process.argv.includes("--live");
const envFileIdx = process.argv.indexOf("--env-file");
const envFile = envFileIdx >= 0 ? process.argv[envFileIdx + 1] : null;
if (envFile) {
  config({ path: resolve(process.cwd(), envFile), override: true });
} else {
  config({ path: resolve(process.cwd(), ".env") });
  config({ path: resolve(process.cwd(), ".env.local"), override: true });
}

function requireSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (key.startsWith("sk_live_") && !liveFlag) {
    throw new Error(
      "Refusing to mutate live Stripe without --live. Re-run with --live --env-file .env.old",
    );
  }
  if (key.startsWith("sk_test_") && liveFlag) {
    throw new Error(
      "STRIPE_SECRET_KEY is a test key. For live, pass --live --env-file .env.old",
    );
  }
  return key;
}

function productMatches(product: Stripe.Product): boolean {
  const metaKey = product.metadata?.flipvise_addon_key?.trim() ?? "";
  if (metaKey === ADDON_KEY || metaKey === `${ADDON_KEY}__archived`) return true;
  return product.name.trim().toLowerCase() === "focus study mode";
}

async function listMatchingProducts(stripe: Stripe): Promise<Stripe.Product[]> {
  const found = new Map<string, Stripe.Product>();
  for (const active of [true, false] as const) {
    for await (const product of stripe.products.list({ active, limit: 100 })) {
      if (productMatches(product)) found.set(product.id, product);
    }
  }
  return [...found.values()];
}

async function archiveProduct(stripe: Stripe, product: Stripe.Product) {
  const prices: Stripe.Price[] = [];
  for await (const price of stripe.prices.list({
    product: product.id,
    limit: 100,
  })) {
    prices.push(price);
  }

  for (const price of prices) {
    if (!price.active) continue;
    for await (const sub of stripe.subscriptions.list({
      price: price.id,
      status: "all",
      limit: 100,
      expand: ["data.items.data"],
    })) {
      const isAddonOnly = sub.metadata?.type === "addon";
      const addonKey = sub.metadata?.addonKey?.trim();
      if (isAddonOnly && addonKey === ADDON_KEY) {
        if (
          sub.status === "active" ||
          sub.status === "trialing" ||
          sub.status === "past_due"
        ) {
          await stripe.subscriptions.cancel(sub.id);
          console.log(`  canceled add-on subscription ${sub.id}`);
        }
        continue;
      }
      for (const item of sub.items.data) {
        if (item.metadata?.addonKey === ADDON_KEY || item.price.id === price.id) {
          if (!isAddonOnly) {
            await stripe.subscriptionItems.del(item.id, {
              proration_behavior: "create_prorations",
            });
            console.log(`  removed add-on item ${item.id} from ${sub.id}`);
          }
        }
      }
    }
    await stripe.prices.update(price.id, { active: false });
    console.log(`  deactivated price ${price.id}`);
  }

  await stripe.products.update(product.id, {
    active: false,
    metadata: {
      ...product.metadata,
      flipvise_addon_key: `${ADDON_KEY}__archived`,
      type: "addon",
      flipvise_retired: "true",
    },
  });
  console.log(`  archived product ${product.id} (${product.name})`);
}

async function main() {
  requireSecretKey();
  const { stripe } = await import("@/lib/stripe");
  const products = await listMatchingProducts(stripe);
  if (products.length === 0) {
    console.log(`No Stripe products found for ${ADDON_KEY}.`);
    return;
  }
  console.log(`Found ${products.length} Stripe product(s) for ${ADDON_KEY}.`);
  for (const product of products) {
    await archiveProduct(stripe, product);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
