/**
 * Set Stripe Tax / Managed Payments tax code on Flipvise plan and add-on products.
 *
 * Usage:
 *   npx tsx scripts/sync-stripe-product-tax-codes.ts --live --env-file .env.old
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import Stripe from "stripe";
import { FLIPVISE_SAAS_TAX_CODE } from "@/lib/stripe-product-tax";

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
    throw new Error("Refusing live Stripe without --live");
  }
  return key;
}

function isFlipviseProduct(product: Stripe.Product): boolean {
  const meta = product.metadata ?? {};
  return Boolean(meta.flipvise_plan || meta.flipvise_addon_key || meta.type === "plan" || meta.type === "addon");
}

async function main() {
  const secret = requireSecretKey();
  const stripe = new Stripe(secret, { apiVersion: "2026-04-22.dahlia" });
  const mode = secret.startsWith("sk_live_") ? "live" : "test";
  console.log(`\n=== Set SaaS tax code (${mode}) ${FLIPVISE_SAAS_TAX_CODE} ===\n`);

  let updated = 0;
  for await (const product of stripe.products.list({ limit: 100 })) {
    if (!product.active) continue;
    const tagged = isFlipviseProduct(product);
    const missingTax = !product.tax_code;
    if (!missingTax) continue;
    if (!tagged && product.name === "Product Test") continue;
    await stripe.products.update(product.id, { tax_code: FLIPVISE_SAAS_TAX_CODE });
    updated += 1;
    console.log(`  ${product.name} (${product.id})`);
  }
  console.log(`\nUpdated ${updated} product(s).\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
