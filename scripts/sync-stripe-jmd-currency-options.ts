/**
 * Add JMD on Stripe Price currency_options for every active USD price.
 *
 * Stripe cannot change an existing currency option amount. Wrong JMD
 * (e.g. monthly JMD pasted onto a yearly USD price) is replaced by a
 * new Price with the correct conversion; the old price is archived.
 *
 * Usage:
 *   npx tsx scripts/sync-stripe-jmd-currency-options.ts --live --env-file .env.old
 *   npx tsx scripts/sync-stripe-jmd-currency-options.ts --live --env-file .env.old --rate=159.21
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import Stripe from "stripe";
import {
  DEFAULT_JMD_PER_USD,
  jmdCurrencyOptionParams,
  usdCentsToJmdCents,
} from "@/lib/stripe-jmd-currency";

const liveFlag = process.argv.includes("--live");
const envFileIdx = process.argv.indexOf("--env-file");
const envFile = envFileIdx >= 0 ? process.argv[envFileIdx + 1] : null;
if (envFile) {
  config({ path: resolve(process.cwd(), envFile), override: true });
} else {
  config({ path: resolve(process.cwd(), ".env") });
  config({ path: resolve(process.cwd(), ".env.local"), override: true });
}

const rateArg = process.argv.find((a) => a.startsWith("--rate="));
const jmdPerUsd = rateArg
  ? Number(rateArg.slice("--rate=".length))
  : Number(process.env.STRIPE_JMD_PER_USD?.trim() || DEFAULT_JMD_PER_USD);

function requireSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (key.startsWith("sk_live_") && !liveFlag) {
    throw new Error("Refusing live Stripe without --live");
  }
  return key;
}

function formatMajor(cents: number, currency: string): string {
  return `${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency.toUpperCase()}`;
}

type CurrencyOptionRow = {
  unit_amount?: number | null;
  unit_amount_decimal?: string | null;
  tax_behavior?: Stripe.Price.TaxBehavior | null;
};

function currencyOptionsOf(price: Stripe.Price): Record<string, CurrencyOptionRow> {
  return (
    (
      price as Stripe.Price & {
        currency_options?: Record<string, CurrencyOptionRow> | null;
      }
    ).currency_options ?? {}
  );
}

function existingJmdCents(price: Stripe.Price): number | null {
  const jmd = currencyOptionsOf(price).jmd;
  if (typeof jmd?.unit_amount === "number") return jmd.unit_amount;
  if (jmd?.unit_amount_decimal != null && jmd.unit_amount_decimal !== "") {
    const n = Number(jmd.unit_amount_decimal);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  return null;
}

function resolvedTaxBehavior(price: Stripe.Price): "exclusive" | "inclusive" {
  return price.tax_behavior === "inclusive" ? "inclusive" : "exclusive";
}

function jmdOnlyCurrencyOptions(
  usdCents: number,
  rate: number,
  taxBehavior: "exclusive" | "inclusive",
): Stripe.PriceUpdateParams["currency_options"] {
  return {
    jmd: jmdCurrencyOptionParams(usdCents, rate, taxBehavior),
  };
}

function extraCurrencyOptions(
  price: Stripe.Price,
  usdCents: number,
  rate: number,
): Stripe.PriceCreateParams["currency_options"] {
  const taxBehavior = resolvedTaxBehavior(price);
  const next: NonNullable<Stripe.PriceCreateParams["currency_options"]> = {};
  for (const [code, row] of Object.entries(currencyOptionsOf(price))) {
    if (code === "jmd" || code === price.currency || row.unit_amount == null) continue;
    next[code] = {
      unit_amount: row.unit_amount,
      tax_behavior:
        row.tax_behavior === "inclusive" || row.tax_behavior === "exclusive"
          ? row.tax_behavior
          : taxBehavior,
    };
  }
  next.jmd = jmdCurrencyOptionParams(usdCents, rate, taxBehavior);
  return next;
}

function envKeysForPriceId(priceId: string): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith("STRIPE_") || !key.endsWith("_PRICE_ID")) continue;
    if (value?.trim() === priceId) keys.push(key);
  }
  return keys;
}

function productDefaultPriceId(product: Stripe.Product): string | null {
  const dp = product.default_price;
  if (typeof dp === "string") return dp;
  if (dp && typeof dp === "object" && "id" in dp) return dp.id;
  return null;
}

async function findActiveUsdPriceWithJmd(
  stripe: Stripe,
  productId: string,
  usdCents: number,
  interval: Stripe.Price.Recurring.Interval | null,
  wantJmd: number,
): Promise<Stripe.Price | null> {
  for await (const listed of stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  })) {
    if (listed.currency !== "usd" || listed.unit_amount !== usdCents) continue;
    const listedInterval = listed.recurring?.interval ?? null;
    if (listedInterval !== interval) continue;
    const full = await stripe.prices.retrieve(listed.id, {
      expand: ["currency_options"],
    });
    if (existingJmdCents(full) === wantJmd) return full;
  }
  return null;
}

async function replacePriceWithCorrectJmd(
  stripe: Stripe,
  product: Stripe.Product,
  price: Stripe.Price,
  usdCents: number,
  rate: number,
  wantJmd: number,
): Promise<Stripe.Price> {
  const interval = price.recurring?.interval ?? null;
  const existing = await findActiveUsdPriceWithJmd(
    stripe,
    product.id,
    usdCents,
    interval,
    wantJmd,
  );
  const created =
    existing && existing.id !== price.id
      ? existing
      : await stripe.prices.create({
          product: product.id,
          currency: "usd",
          unit_amount: usdCents,
          nickname: price.nickname ?? undefined,
          metadata: price.metadata,
          tax_behavior: resolvedTaxBehavior(price),
          currency_options: extraCurrencyOptions(price, usdCents, rate),
          ...(price.recurring
            ? {
                recurring: {
                  interval: price.recurring.interval,
                  interval_count: price.recurring.interval_count ?? 1,
                },
              }
            : {}),
        });

  if (productDefaultPriceId(product) === price.id) {
    await stripe.products.update(product.id, { default_price: created.id });
    product.default_price = created.id;
  }
  if (created.id !== price.id) {
    await stripe.prices.update(price.id, { active: false });
  }
  return created;
}

function productIdFromPrice(price: Stripe.Price): string | null {
  const product = price.product;
  if (typeof product === "string") return product;
  if (product && typeof product === "object" && "id" in product) return product.id;
  return null;
}

async function reconcileEnvPriceIds(
  stripe: Stripe,
  rate: number,
): Promise<string[]> {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith("STRIPE_") || !key.endsWith("_PRICE_ID")) continue;
    const id = value?.trim();
    if (!id?.startsWith("price_")) continue;
    let price: Stripe.Price;
    try {
      price = await stripe.prices.retrieve(id, { expand: ["currency_options"] });
    } catch {
      continue;
    }
    const usdCents = price.unit_amount ?? 0;
    if (price.currency !== "usd" || usdCents <= 0) continue;
    const wantJmd = usdCentsToJmdCents(usdCents, rate);
    if (price.active && existingJmdCents(price) === wantJmd) continue;
    const productId = productIdFromPrice(price);
    if (!productId) continue;
    const replacement = await findActiveUsdPriceWithJmd(
      stripe,
      productId,
      usdCents,
      price.recurring?.interval ?? null,
      wantJmd,
    );
    if (replacement && replacement.id !== price.id) {
      lines.push(`${key}=${replacement.id}`);
    }
  }
  return lines;
}

async function main() {
  if (!Number.isFinite(jmdPerUsd) || jmdPerUsd <= 0) {
    throw new Error(`Invalid JMD per USD rate: ${jmdPerUsd}`);
  }

  const secret = requireSecretKey();
  const stripe = new Stripe(secret, { apiVersion: "2026-04-22.dahlia" });
  const mode = secret.startsWith("sk_live_") ? "live" : "test";
  console.log(`\n=== Add JMD currency options (${mode}) @ ${jmdPerUsd} JMD / USD ===\n`);

  let added = 0;
  let replaced = 0;
  let skipped = 0;
  const envReplacements: string[] = [];

  for await (const product of stripe.products.list({ active: true, limit: 100 })) {
    if (!product.active) continue;

    for await (const listed of stripe.prices.list({
      product: product.id,
      active: true,
      limit: 100,
    })) {
      if (listed.currency !== "usd") {
        skipped += 1;
        continue;
      }
      if (listed.unit_amount == null || listed.unit_amount <= 0) {
        skipped += 1;
        continue;
      }

      const price = await stripe.prices.retrieve(listed.id, {
        expand: ["currency_options"],
      });
      const usdCents = price.unit_amount ?? 0;
      const wantJmd = usdCentsToJmdCents(usdCents, jmdPerUsd);
      const haveJmd = existingJmdCents(price);
      const interval = price.recurring?.interval ?? "one_time";
      const label = `${product.name} · ${interval} ${price.id}`;

      if (haveJmd === wantJmd) {
        skipped += 1;
        continue;
      }

      if (haveJmd == null) {
        try {
          await stripe.prices.update(price.id, {
            currency_options: jmdOnlyCurrencyOptions(
              usdCents,
              jmdPerUsd,
              resolvedTaxBehavior(price),
            ),
          });
          added += 1;
          console.log(
            `  + ${label}: ${formatMajor(usdCents, "usd")} → ${formatMajor(wantJmd, "jmd")}`,
          );
          continue;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!message.includes("immutable field")) throw error;
          console.log(`  ! ${label}: add failed (JMD already present), replacing price`);
        }
      }

      const created = await replacePriceWithCorrectJmd(
        stripe,
        product,
        price,
        usdCents,
        jmdPerUsd,
        wantJmd,
      );
      replaced += 1;
      console.log(
        `  ~ ${label}: ${haveJmd == null ? "existing JMD" : formatMajor(haveJmd, "jmd")} → ${formatMajor(wantJmd, "jmd")} as ${created.id}`,
      );
      for (const envKey of envKeysForPriceId(price.id)) {
        envReplacements.push(`${envKey}=${created.id}`);
      }
    }
  }

  const envFromCatalog = await reconcileEnvPriceIds(stripe, jmdPerUsd);
  const allEnv = [...new Set([...envReplacements, ...envFromCatalog])];

  console.log(
    `\nAdded JMD on ${added}, replaced ${replaced} (immutable amount), skipped ${skipped}.`,
  );
  if (allEnv.length) {
    console.log("\n--- Paste into Render Environment (replaced price IDs) ---\n");
    console.log(allEnv.join("\n"));
    console.log("");
  } else {
    console.log("");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
