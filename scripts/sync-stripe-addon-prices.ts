/**
 * Sync Flipvise add-on catalog products/prices with Stripe (test or live mode
 * matching STRIPE_SECRET_KEY). Idempotent: reuses products tagged with
 * metadata.flipvise_addon_key and existing env price IDs when valid.
 *
 * Usage:
 *   npx tsx scripts/sync-stripe-addon-prices.ts
 *   npx tsx scripts/sync-stripe-addon-prices.ts --write-env
 *
 * Default monthly/yearly amounts (USD cents) can be overridden:
 *   AI_ESSAY_MONTHLY_CENTS=999 AI_ESSAY_YEARLY_CENTS=9900
 *   LIVE_CLASSROOM_MONTHLY_CENTS=1999 LIVE_CLASSROOM_YEARLY_CENTS=19900 ...
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import Stripe from "stripe";
import { listAddonCatalog } from "@/db/queries/addons";
import {
  resolveStripeAddonPriceIdFromEnvKey,
  stripeAddonYearlyPriceEnvKeyFromMonthly,
} from "@/lib/stripe-addon-price-env";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const writeEnv = process.argv.includes("--write-env");

type AddonSyncSpec = {
  key: string;
  name: string;
  description: string;
  monthlyEnvKey: string;
  yearlyEnvKey: string | null;
  monthlyCents: number;
  yearlyCents: number | null;
};

const DEFAULT_AMOUNTS: Record<
  string,
  { monthlyCents: number; yearlyCents: number | null }
> = {
  ai_essay: { monthlyCents: 999, yearlyCents: 9900 },
  study_mode_focus: { monthlyCents: 499, yearlyCents: 4900 },
  /** Organization add-on — Team / Enterprise / Education Gold+Enterprise only. */
  live_classroom: { monthlyCents: 1999, yearlyCents: 19900 },
};

function requireSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return key;
}

async function findProductByAddonKey(
  stripe: Stripe,
  addonKey: string,
): Promise<Stripe.Product | null> {
  // Prefer list+filter — Search API can lag right after create.
  for await (const product of stripe.products.list({
    active: true,
    limit: 100,
  })) {
    if (product.metadata?.flipvise_addon_key === addonKey) {
      return product;
    }
  }
  try {
    const listed = await stripe.products.search({
      query: `metadata['flipvise_addon_key']:'${addonKey}'`,
      limit: 1,
    });
    return listed.data[0] ?? null;
  } catch {
    return null;
  }
}

async function ensureProduct(
  stripe: Stripe,
  spec: AddonSyncSpec,
): Promise<Stripe.Product> {
  const existing = await findProductByAddonKey(stripe, spec.key);
  if (existing) {
    if (!existing.active) {
      return stripe.products.update(existing.id, { active: true });
    }
    return existing;
  }
  return stripe.products.create({
    name: spec.name,
    description: spec.description,
    metadata: {
      flipvise_addon_key: spec.key,
      type: "addon",
    },
  });
}

/** Prefer the oldest active product when duplicates exist from prior sync races. */
async function resolveCanonicalProduct(
  stripe: Stripe,
  addonKey: string,
  preferred: Stripe.Product,
): Promise<Stripe.Product> {
  const matches: Stripe.Product[] = [];
  for await (const product of stripe.products.list({
    active: true,
    limit: 100,
  })) {
    if (product.metadata?.flipvise_addon_key === addonKey) {
      matches.push(product);
    }
  }
  if (matches.length <= 1) return preferred;
  matches.sort((a, b) => a.created - b.created);
  const keeper = matches[0]!;
  for (const dup of matches.slice(1)) {
    await stripe.products.update(dup.id, {
      active: false,
      metadata: {
        ...dup.metadata,
        flipvise_addon_key: `${addonKey}__archived`,
        flipvise_archived_duplicate: "true",
      },
    });
    console.log(`  archived duplicate product ${dup.id}`);
  }
  return keeper;
}

async function priceMatches(
  stripe: Stripe,
  priceId: string | null | undefined,
  productId: string,
  interval: "month" | "year",
): Promise<Stripe.Price | null> {
  if (!priceId?.startsWith("price_")) return null;
  try {
    const price = await stripe.prices.retrieve(priceId);
    if (
      price.active &&
      price.type === "recurring" &&
      price.recurring?.interval === interval &&
      (typeof price.product === "string" ? price.product : price.product.id) ===
        productId
    ) {
      return price;
    }
  } catch {
    // missing / wrong account
  }
  return null;
}

async function findOrCreateRecurringPrice(
  stripe: Stripe,
  productId: string,
  interval: "month" | "year",
  unitAmount: number,
  preferredPriceId: string | null,
): Promise<Stripe.Price> {
  const preferred = await priceMatches(
    stripe,
    preferredPriceId,
    productId,
    interval,
  );
  if (preferred) return preferred;

  const existing = await stripe.prices.list({
    product: productId,
    active: true,
    type: "recurring",
    limit: 100,
  });
  const match = existing.data.find(
    (p) =>
      p.recurring?.interval === interval &&
      p.unit_amount === unitAmount &&
      p.currency === "usd",
  );
  if (match) return match;

  return stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: unitAmount,
    recurring: { interval },
    metadata: {
      type: "addon",
      period: interval === "month" ? "monthly" : "yearly",
    },
  });
}

function upsertEnvLocal(updates: Record<string, string>): void {
  const path = resolve(process.cwd(), ".env.local");
  let text = "";
  try {
    text = readFileSync(path, "utf8");
  } catch {
    text = "";
  }
  const lines = text.length ? text.split(/\r?\n/) : [];
  const keys = new Set(Object.keys(updates));
  const next: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)=/);
    if (m && keys.has(m[1])) {
      next.push(`${m[1]}=${updates[m[1]]}`);
      seen.add(m[1]);
    } else {
      next.push(line);
    }
  }

  for (const key of keys) {
    if (!seen.has(key)) {
      if (next.length && next[next.length - 1] !== "") next.push("");
      next.push(`${key}=${updates[key]}`);
    }
  }

  writeFileSync(path, next.join("\n").replace(/\n+$/, "\n"), "utf8");
}

async function main() {
  const secret = requireSecretKey();
  const stripe = new Stripe(secret, { apiVersion: "2026-04-22.dahlia" });
  const mode = secret.startsWith("sk_live_") ? "live" : "test";

  const catalog = await listAddonCatalog();
  const sellable = catalog.filter(
    (row) => row.active && row.stripePriceEnvKey.trim() !== "",
  );

  if (sellable.length === 0) {
    console.log("No active catalog add-ons with stripePriceEnvKey.");
    return;
  }

  console.log(`\n=== Sync Stripe add-on prices (${mode}) ===\n`);

  const envUpdates: Record<string, string> = {};

  for (const row of sellable) {
    const amounts = DEFAULT_AMOUNTS[row.key] ?? {
      monthlyCents: 999,
      yearlyCents: 9900,
    };
    const monthlyOverride = process.env[
      `${row.key.toUpperCase()}_MONTHLY_CENTS`
    ];
    const yearlyOverride = process.env[`${row.key.toUpperCase()}_YEARLY_CENTS`];
    const yearlyEnvKey = stripeAddonYearlyPriceEnvKeyFromMonthly(
      row.stripePriceEnvKey,
    );

    const spec: AddonSyncSpec = {
      key: row.key,
      name: row.name,
      description: row.description || row.marketingBlurb || row.name,
      monthlyEnvKey: row.stripePriceEnvKey,
      yearlyEnvKey,
      monthlyCents: monthlyOverride
        ? Number(monthlyOverride)
        : amounts.monthlyCents,
      yearlyCents:
        yearlyEnvKey == null
          ? null
          : yearlyOverride
            ? Number(yearlyOverride)
            : amounts.yearlyCents,
    };

    console.log(`→ ${spec.name} (${spec.key})`);
    const createdOrFound = await ensureProduct(stripe, spec);
    const product = await resolveCanonicalProduct(
      stripe,
      spec.key,
      createdOrFound,
    );
    console.log(`  product: ${product.id}`);

    const monthlyPreferred = resolveStripeAddonPriceIdFromEnvKey(
      spec.monthlyEnvKey,
      "monthly",
    );
    const monthly = await findOrCreateRecurringPrice(
      stripe,
      product.id,
      "month",
      spec.monthlyCents,
      monthlyPreferred,
    );
    envUpdates[spec.monthlyEnvKey] = monthly.id;
    console.log(
      `  monthly: ${monthly.id} ($${(monthly.unit_amount ?? 0) / 100}/mo)`,
    );

    if (spec.yearlyEnvKey && spec.yearlyCents != null) {
      const yearlyPreferred = resolveStripeAddonPriceIdFromEnvKey(
        spec.monthlyEnvKey,
        "yearly",
      );
      const yearly = await findOrCreateRecurringPrice(
        stripe,
        product.id,
        "year",
        spec.yearlyCents,
        yearlyPreferred,
      );
      envUpdates[spec.yearlyEnvKey] = yearly.id;
      console.log(
        `  yearly:  ${yearly.id} ($${(yearly.unit_amount ?? 0) / 100}/yr)`,
      );
    }
    console.log("");
  }

  if (writeEnv) {
    upsertEnvLocal(envUpdates);
    console.log("Updated .env.local with Stripe price IDs.");
    console.log("Restart `npm run dev` so Next.js picks up the new env.\n");
  } else {
    console.log("Env keys to set (re-run with --write-env to apply):\n");
    for (const [k, v] of Object.entries(envUpdates)) {
      console.log(`${k}=${v}`);
    }
    console.log("");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
