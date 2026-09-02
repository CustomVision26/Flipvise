/**
 * Export active Stripe products with monthly and yearly prices to a PDF.
 *
 * Usage:
 *   npx tsx scripts/export-stripe-products-pdf.ts
 *   npx tsx scripts/export-stripe-products-pdf.ts --env-file .env.old
 *   npx tsx scripts/export-stripe-products-pdf.ts --out exports/catalog.pdf
 */

import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { jsPDF } from "jspdf";
import type Stripe from "stripe";

const envFileIdx = process.argv.indexOf("--env-file");
const envFile = envFileIdx >= 0 ? process.argv[envFileIdx + 1] : null;
if (envFile) {
  config({ path: resolve(process.cwd(), envFile), override: true });
} else {
  config({ path: resolve(process.cwd(), ".env") });
  config({ path: resolve(process.cwd(), ".env.local"), override: true });
}

const outIdx = process.argv.indexOf("--out");

type ProductKind = "Plan" | "Add-on" | "Other";

type CatalogRow = {
  name: string;
  kind: ProductKind;
  monthlyLabel: string;
  yearlyChargeLabel: string;
  yearlyMonthlyLabel: string;
};

function stripeModeFromSecret(key: string | undefined): "test" | "live" | "unknown" {
  const value = key?.trim() ?? "";
  if (value.startsWith("sk_test_")) return "test";
  if (value.startsWith("sk_live_")) return "live";
  return "unknown";
}

function formatMoney(unitAmount: number | null, currency: string): string {
  if (unitAmount == null) return "—";
  const major = unitAmount / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase() || "USD",
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function productKind(product: Stripe.Product): ProductKind {
  const meta = product.metadata ?? {};
  if (meta.flipvise_plan || meta.type === "plan") return "Plan";
  if (meta.flipvise_addon_key || meta.type === "addon") return "Add-on";
  return "Other";
}

function kindRank(kind: ProductKind): number {
  if (kind === "Plan") return 0;
  if (kind === "Add-on") return 1;
  return 2;
}

function pickRecurringPrice(
  prices: Stripe.Price[],
  interval: "month" | "year",
): Stripe.Price | null {
  const matches = prices.filter(
    (price) =>
      price.active &&
      price.type === "recurring" &&
      price.recurring?.interval === interval &&
      price.recurring.interval_count === 1,
  );
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.created - a.created);
  return matches[0] ?? null;
}

async function listAllProducts(stripe: Stripe): Promise<Stripe.Product[]> {
  const products: Stripe.Product[] = [];
  for await (const product of stripe.products.list({ limit: 100, active: true })) {
    if (product.metadata?.flipvise_addon_key?.endsWith("__archived")) continue;
    products.push(product);
  }
  return products;
}

async function listActivePricesForProduct(
  stripe: Stripe,
  productId: string,
): Promise<Stripe.Price[]> {
  const prices: Stripe.Price[] = [];
  for await (const price of stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  })) {
    prices.push(price);
  }
  return prices;
}

function toRow(product: Stripe.Product, prices: Stripe.Price[]): CatalogRow {
  const monthly = pickRecurringPrice(prices, "month");
  const yearly = pickRecurringPrice(prices, "year");
  const currency = monthly?.currency ?? yearly?.currency ?? "usd";
  const yearlyAmount = yearly?.unit_amount ?? null;
  const yearlyMonthly =
    yearlyAmount != null ? Math.round(yearlyAmount / 12) : null;

  return {
    name: product.name.trim() || product.id,
    kind: productKind(product),
    monthlyLabel: formatMoney(monthly?.unit_amount ?? null, monthly?.currency ?? currency),
    yearlyChargeLabel: formatMoney(yearlyAmount, yearly?.currency ?? currency),
    yearlyMonthlyLabel: formatMoney(yearlyMonthly, yearly?.currency ?? currency),
  };
}

function drawCatalogPdf(rows: CatalogRow[], mode: string): ArrayBuffer {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const generated = new Date().toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const cols = {
    name: margin,
    kind: margin + 210,
    monthly: margin + 280,
    yearly: margin + 370,
    yearlyMo: margin + 470,
  };
  const nameWidth = 196;

  function header(page: number) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(26, 35, 50);
    doc.text("Flipvise Stripe products and prices", margin, margin);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(`Generated ${generated}  ·  Stripe ${mode} mode`, margin, margin + 18);
    doc.text(
      "Yearly prices are the amount billed once per year. Equivalent /mo is that amount ÷ 12.",
      margin,
      margin + 32,
    );

    const tableTop = margin + 52;
    doc.setFillColor(26, 35, 50);
    doc.rect(margin, tableTop, pageW - margin * 2, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255);
    const hy = tableTop + 15;
    doc.text("Product", cols.name + 6, hy);
    doc.text("Type", cols.kind, hy);
    doc.text("Monthly", cols.monthly, hy);
    doc.text("Yearly charge", cols.yearly, hy);
    doc.text("Yearly /mo", cols.yearlyMo, hy);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(`Page ${page}`, pageW - margin, pageH - 28, { align: "right" });
    doc.text("Flipvise Studio LLC", margin, pageH - 28);
  }

  let page = 1;
  header(page);
  let y = margin + 86;

  rows.forEach((row, index) => {
    const nameLines = doc.splitTextToSize(row.name, nameWidth) as string[];
    const rowH = Math.max(22, nameLines.length * 12 + 10);
    if (y + rowH > pageH - 48) {
      doc.addPage();
      page += 1;
      header(page);
      y = margin + 86;
    }

    if (index % 2 === 0) {
      doc.setFillColor(246, 247, 249);
      doc.rect(margin, y - 12, pageW - margin * 2, rowH, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(26, 35, 50);
    doc.text(nameLines, cols.name + 6, y);
    doc.setTextColor(80);
    doc.text(row.kind, cols.kind, y);
    doc.setTextColor(26, 35, 50);
    doc.text(row.monthlyLabel, cols.monthly, y);
    doc.text(row.yearlyChargeLabel, cols.yearly, y);
    doc.text(row.yearlyMonthlyLabel, cols.yearlyMo, y);
    y += rowH;
  });

  return doc.output("arraybuffer");
}

async function main() {
  const mode = stripeModeFromSecret(process.env.STRIPE_SECRET_KEY);
  if (mode === "unknown") {
    throw new Error("STRIPE_SECRET_KEY is missing or not a Stripe secret key.");
  }

  const { stripe } = await import("@/lib/stripe");
  const products = await listAllProducts(stripe);
  const rows: CatalogRow[] = [];

  for (const product of products) {
    const prices = await listActivePricesForProduct(stripe, product.id);
    rows.push(toRow(product, prices));
  }

  rows.sort((a, b) => {
    const kindDiff = kindRank(a.kind) - kindRank(b.kind);
    if (kindDiff !== 0) return kindDiff;
    return a.name.localeCompare(b.name);
  });

  const defaultName = `Flipvise-Stripe-Products-and-Prices-${mode}.pdf`;
  const outPath = resolve(
    process.cwd(),
    outIdx >= 0 && process.argv[outIdx + 1]
      ? process.argv[outIdx + 1]!
      : resolve("exports", defaultName),
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, Buffer.from(drawCatalogPdf(rows, mode)));

  console.log(`Wrote ${outPath}`);
  console.log(`${rows.length} active Stripe products (${mode} mode).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
