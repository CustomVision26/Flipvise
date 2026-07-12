/**
 * Backfill account_deletion_proration_ledger from Stripe history.
 *
 * Sources:
 *  1. Refunds with metadata.reason = account_deletion_proration (confirmed auto-refunds)
 *  2. Canceled subscriptions (immediate cancel, mid-period) with no matching refund
 *     — flagged as pending_manual for admin review
 *
 * Usage:
 *   npm run db:backfill-deletion-proration-ledger              # dry-run
 *   npm run db:backfill-deletion-proration-ledger -- --execute # write rows
 *   npm run db:backfill-deletion-proration-ledger -- --execute --allow-live
 *   npm run db:backfill-deletion-proration-ledger -- --since=2025-01-01
 *
 * Requires STRIPE_SECRET_KEY + DATABASE_URL. Defaults to dry-run; test keys only unless --allow-live.
 */

import { config } from "dotenv";
import { resolve } from "path";
import type Stripe from "stripe";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

import {
  insertAccountDeletionProrationLedger,
  listLedgerStripeSubscriptionIds,
  type InsertAccountDeletionProrationLedgerInput,
} from "@/db/queries/account-deletion-proration";

type CliOptions = {
  execute: boolean;
  allowLive: boolean;
  sinceMs: number | null;
  includeUnrefundedCanceled: boolean;
};

type BackfillCandidate = InsertAccountDeletionProrationLedgerInput & {
  source: "deletion_refund" | "canceled_no_refund";
};

function parseArgs(argv: string[]): CliOptions {
  const sinceArg = argv.find((a) => a.startsWith("--since="));
  let sinceMs: number | null = null;
  if (sinceArg) {
    const raw = sinceArg.slice("--since=".length).trim();
    const parsed = Date.parse(raw);
    if (Number.isNaN(parsed)) {
      console.error(`Invalid --since date: ${raw}`);
      process.exit(1);
    }
    sinceMs = parsed;
  }

  return {
    execute: argv.includes("--execute"),
    allowLive: argv.includes("--allow-live"),
    sinceMs,
    includeUnrefundedCanceled: !argv.includes("--refunds-only"),
  };
}

function stripeKeyMode(value: string): "test" | "live" | "unknown" {
  if (value.startsWith("sk_test_")) return "test";
  if (value.startsWith("sk_live_")) return "live";
  return "unknown";
}

function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function customerIdFromSubscription(sub: Stripe.Subscription): string | null {
  return typeof sub.customer === "string"
    ? sub.customer
    : sub.customer && typeof sub.customer === "object"
      ? sub.customer.id
      : null;
}

function subscriptionPeriodEndSec(sub: Stripe.Subscription): number | null {
  const item = sub.items.data[0] as Stripe.SubscriptionItem & {
    current_period_end?: number;
  };
  return typeof item?.current_period_end === "number" ? item.current_period_end : null;
}

async function customerIdFromRefund(
  stripe: Stripe,
  refund: Stripe.Refund,
): Promise<string | null> {
  const paymentIntentId =
    typeof refund.payment_intent === "string"
      ? refund.payment_intent
      : refund.payment_intent && typeof refund.payment_intent === "object"
        ? refund.payment_intent.id
        : null;
  if (paymentIntentId) {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (typeof pi.customer === "string") return pi.customer;
    if (pi.customer && typeof pi.customer === "object") return pi.customer.id;
  }

  const chargeId =
    typeof refund.charge === "string"
      ? refund.charge
      : refund.charge && typeof refund.charge === "object"
        ? refund.charge.id
        : null;
  if (chargeId) {
    const charge = await stripe.charges.retrieve(chargeId);
    if (typeof charge.customer === "string") return charge.customer;
    if (charge.customer && typeof charge.customer === "object") return charge.customer.id;
  }

  return null;
}

async function fallbackSubscriptionIdFromRefund(
  stripe: Stripe,
  refund: Stripe.Refund,
): Promise<string | null> {
  const customerId = await customerIdFromRefund(stripe, refund);
  if (!customerId) return null;

  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "canceled",
    limit: 20,
  });

  const refundSec = refund.created;
  const amount = refund.amount ?? 0;

  const candidates = subs.data
    .filter((s) => s.metadata?.clerkUserId?.trim())
    .filter((s) => !s.cancel_at_period_end)
    .filter((s) => s.canceled_at != null)
    .sort((a, b) => Math.abs((a.canceled_at ?? 0) - refundSec) - Math.abs((b.canceled_at ?? 0) - refundSec));

  if (candidates.length === 0) return null;

  const best = candidates[0]!;
  if (Math.abs((best.canceled_at ?? 0) - refundSec) > 7 * 24 * 60 * 60) {
    return null;
  }

  if (amount > 0) {
    const estimate = await estimateHistoricalDeletionProrationFallback(
      stripe,
      best.id,
      best.canceled_at ?? refundSec,
    );
    if (estimate && Math.abs(estimate.refundCents - amount) > Math.max(100, amount * 0.15)) {
      return null;
    }
  }

  return best.id;
}

async function estimateHistoricalDeletionProrationFallback(
  stripe: Stripe,
  stripeSubscriptionId: string,
  canceledAtSec: number,
): Promise<{ refundCents: number } | null> {
  const { estimateHistoricalDeletionProration } = await import(
    "@/lib/stripe-account-deletion"
  );
  const est = await estimateHistoricalDeletionProration(
    stripeSubscriptionId,
    canceledAtSec,
  );
  return est ? { refundCents: est.refundCents } : null;
}

async function resolveSubscriptionIdFromRefund(
  stripe: Stripe,
  refund: Stripe.Refund,
): Promise<string | null> {
  const paymentIntentId =
    typeof refund.payment_intent === "string"
      ? refund.payment_intent
      : refund.payment_intent && typeof refund.payment_intent === "object"
        ? refund.payment_intent.id
        : null;

  if (paymentIntentId) {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    const invoiceId =
      typeof pi.invoice === "string"
        ? pi.invoice
        : pi.invoice && typeof pi.invoice === "object"
          ? pi.invoice.id
          : null;
    if (invoiceId) {
      const invoice = await stripe.invoices.retrieve(invoiceId);
      const subId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription && typeof invoice.subscription === "object"
            ? invoice.subscription.id
            : null;
      if (subId) return subId;
    }
  }

  const chargeId =
    typeof refund.charge === "string"
      ? refund.charge
      : refund.charge && typeof refund.charge === "object"
        ? refund.charge.id
        : null;
  if (!chargeId) return null;

  const charge = await stripe.charges.retrieve(chargeId);
  const invoiceId =
    typeof charge.invoice === "string"
      ? charge.invoice
      : charge.invoice && typeof charge.invoice === "object"
        ? charge.invoice.id
        : null;
  if (!invoiceId) return null;

  const invoice = await stripe.invoices.retrieve(invoiceId);
  return typeof invoice.subscription === "string"
    ? invoice.subscription
    : invoice.subscription && typeof invoice.subscription === "object"
      ? invoice.subscription.id
      : null;
}

async function resolveSubscriptionIdFromRefundWithFallback(
  stripe: Stripe,
  refund: Stripe.Refund,
): Promise<string | null> {
  const direct = await resolveSubscriptionIdFromRefund(stripe, refund);
  if (direct) return direct;
  return fallbackSubscriptionIdFromRefund(stripe, refund);
}

async function customerContact(
  stripe: Stripe,
  customerId: string,
): Promise<{ email: string | null; name: string | null }> {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return { email: null, name: null };
  return {
    email: customer.email?.toLowerCase() ?? null,
    name: customer.name ?? null,
  };
}

async function collectDeletionRefunds(
  stripe: Stripe,
  sinceMs: number | null,
): Promise<Stripe.Refund[]> {
  const out: Stripe.Refund[] = [];
  for await (const refund of stripe.refunds.list({ limit: 100 })) {
    if (sinceMs != null && refund.created * 1000 < sinceMs) continue;
    if (refund.metadata?.reason === "account_deletion_proration") {
      out.push(refund);
    }
  }
  return out;
}

async function buildCandidateFromRefund(
  stripe: Stripe,
  refund: Stripe.Refund,
): Promise<BackfillCandidate | null> {
  const subscriptionId = await resolveSubscriptionIdFromRefundWithFallback(stripe, refund);
  if (!subscriptionId) {
    console.warn(`  skip refund ${refund.id}: could not resolve subscription`);
    return null;
  }

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const clerkUserId = sub.metadata?.clerkUserId?.trim();
  if (!clerkUserId) {
    console.warn(`  skip refund ${refund.id}: subscription ${subscriptionId} has no clerkUserId`);
    return null;
  }

  const customerId = customerIdFromSubscription(sub);
  if (!customerId) return null;

  const contact = await customerContact(stripe, customerId);
  const periodEndSec = subscriptionPeriodEndSec(sub);
  const refundCents = refund.amount ?? 0;

  let stripeInvoiceId: string | null = null;
  const paymentIntentId =
    typeof refund.payment_intent === "string"
      ? refund.payment_intent
      : refund.payment_intent && typeof refund.payment_intent === "object"
        ? refund.payment_intent.id
        : null;
  if (paymentIntentId) {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    stripeInvoiceId =
      typeof pi.invoice === "string"
        ? pi.invoice
        : pi.invoice && typeof pi.invoice === "object"
          ? pi.invoice.id
          : null;
  }
  if (!stripeInvoiceId) {
    const chargeId =
      typeof refund.charge === "string"
        ? refund.charge
        : refund.charge && typeof refund.charge === "object"
          ? refund.charge.id
          : null;
    if (chargeId) {
      const charge = await stripe.charges.retrieve(chargeId);
      stripeInvoiceId =
        typeof charge.invoice === "string"
          ? charge.invoice
          : charge.invoice && typeof charge.invoice === "object"
            ? charge.invoice.id
            : null;
    }
  }

  return {
    source: "deletion_refund",
    clerkUserId,
    userEmail: contact.email,
    userDisplayName: contact.name,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    stripeInvoiceId,
    planSlug: sub.metadata?.plan ?? null,
    subscriptionPeriodEnd: periodEndSec ? new Date(periodEndSec * 1000) : null,
    deletedAt: new Date(refund.created * 1000),
    estimatedRefundCents: refundCents,
    refundedCents: refundCents,
    currency: refund.currency,
    refundStatus: "auto_issued",
    stripeRefundId: refund.id,
    refundError: null,
  };
}

async function collectCanceledDeletionCandidates(
  stripe: Stripe,
  sinceMs: number | null,
  existingSubIds: Set<string>,
  refundSubIds: Set<string>,
  estimateHistoricalDeletionProration: (
    stripeSubscriptionId: string,
    canceledAtSec: number,
  ) => Promise<{
    refundCents: number;
    currency: string;
    stripeInvoiceId: string | null;
    periodEnd: Date | null;
    planSlug: string | null;
  } | null>,
): Promise<BackfillCandidate[]> {
  const out: BackfillCandidate[] = [];

  for await (const sub of stripe.subscriptions.search({
    query: "status:'canceled'",
    limit: 100,
  })) {
    if (sinceMs != null && (sub.canceled_at ?? sub.created) * 1000 < sinceMs) continue;

    const clerkUserId = sub.metadata?.clerkUserId?.trim();
    if (!clerkUserId) continue;
    if (existingSubIds.has(sub.id) || refundSubIds.has(sub.id)) continue;
    if (sub.cancel_at_period_end) continue;

    const canceledAt = sub.canceled_at;
    const periodEndSec = subscriptionPeriodEndSec(sub);
    if (!canceledAt || !periodEndSec || canceledAt >= periodEndSec) continue;

    const estimate = await estimateHistoricalDeletionProration(sub.id, canceledAt);
    if (!estimate || estimate.refundCents <= 0) continue;

    const customerId = customerIdFromSubscription(sub);
    if (!customerId) continue;

    const contact = await customerContact(stripe, customerId);

    out.push({
      source: "canceled_no_refund",
      clerkUserId,
      userEmail: contact.email,
      userDisplayName: contact.name,
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      stripeInvoiceId: estimate.stripeInvoiceId,
      planSlug: estimate.planSlug ?? sub.metadata?.plan ?? null,
      subscriptionPeriodEnd: estimate.periodEnd,
      deletedAt: new Date(canceledAt * 1000),
      estimatedRefundCents: estimate.refundCents,
      refundedCents: null,
      currency: estimate.currency,
      refundStatus: "pending_manual",
      stripeRefundId: null,
      refundError: "Backfilled from Stripe — no account_deletion_proration refund found.",
    });
  }

  return out;
}

function printCandidate(c: BackfillCandidate) {
  console.log(
    [
      `  [${c.source}] sub=${c.stripeSubscriptionId}`,
      `user=${c.userDisplayName ?? c.clerkUserId}`,
      `email=${c.userEmail ?? "—"}`,
      `owed=${formatMoney(c.estimatedRefundCents, c.currency)}`,
      `status=${c.refundStatus}`,
      c.stripeRefundId ? `refund=${c.stripeRefundId}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
  );
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    console.error("Missing STRIPE_SECRET_KEY");
    process.exit(1);
  }

  const mode = stripeKeyMode(secretKey);
  if (mode === "unknown") {
    console.error("Invalid STRIPE_SECRET_KEY format");
    process.exit(1);
  }
  if (mode === "live" && !opts.allowLive) {
    console.error("Refusing live Stripe key without --allow-live");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("Missing DATABASE_URL");
    process.exit(1);
  }

  const { stripe } = await import("@/lib/stripe");
  const { estimateHistoricalDeletionProration } = await import(
    "@/lib/stripe-account-deletion"
  );

  console.log(
    opts.execute
      ? "EXECUTE mode — writing ledger rows"
      : "DRY-RUN — pass --execute to insert rows",
  );
  if (opts.sinceMs) {
    console.log(`Since filter: ${new Date(opts.sinceMs).toISOString()}`);
  }
  console.log("");

  const existingSubIds = await listLedgerStripeSubscriptionIds();
  console.log(`Existing ledger rows: ${existingSubIds.size}`);

  const refunds = await collectDeletionRefunds(stripe, opts.sinceMs);
  console.log(`Found ${refunds.length} account_deletion_proration refund(s) in Stripe\n`);

  const candidates: BackfillCandidate[] = [];
  const refundSubIds = new Set<string>();

  for (const refund of refunds) {
    const candidate = await buildCandidateFromRefund(stripe, refund);
    if (!candidate) continue;
    if (existingSubIds.has(candidate.stripeSubscriptionId)) {
      console.log(`  skip ${candidate.stripeSubscriptionId} (already in ledger)`);
      continue;
    }
    refundSubIds.add(candidate.stripeSubscriptionId);
    candidates.push(candidate);
  }

  if (opts.includeUnrefundedCanceled) {
    console.log("\nScanning canceled subscriptions (immediate cancel, mid-period)…");
    const canceledCandidates = await collectCanceledDeletionCandidates(
      stripe,
      opts.sinceMs,
      existingSubIds,
      refundSubIds,
      estimateHistoricalDeletionProration,
    );
    console.log(`Found ${canceledCandidates.length} canceled sub(s) without deletion refund\n`);
    candidates.push(...canceledCandidates);
  }

  if (candidates.length === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  console.log(`\n${candidates.length} row(s) to insert:\n`);
  for (const c of candidates) {
    printCandidate(c);
  }

  if (!opts.execute) {
    console.log("\nDry-run complete. Re-run with --execute to insert.");
    return;
  }

  let inserted = 0;
  let skipped = 0;

  for (const c of candidates) {
    const row = await insertAccountDeletionProrationLedger(c);
    if (row) {
      inserted++;
    } else {
      skipped++;
    }
  }

  console.log(`\nDone. Inserted ${inserted}, skipped (duplicate) ${skipped}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
