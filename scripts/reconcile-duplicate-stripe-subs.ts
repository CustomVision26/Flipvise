/**
 * Find and reconcile duplicate active Stripe subscriptions (Pro + Pro Plus checkout bug).
 * Keeps the highest-tier subscription, then newest by created time.
 * Syncs Clerk billing metadata + stripe_subscriptions row + recent invoices.
 *
 * Usage:
 *   npx tsx scripts/reconcile-duplicate-stripe-subs.ts --email user@example.com
 *   npx tsx scripts/reconcile-duplicate-stripe-subs.ts --user user_xxx
 *   npx tsx scripts/reconcile-duplicate-stripe-subs.ts --all
 *   npx tsx scripts/reconcile-duplicate-stripe-subs.ts --email user@example.com --execute
 *   npx tsx scripts/reconcile-duplicate-stripe-subs.ts --all --execute --refund
 *
 * Defaults to dry-run. Requires sk_test_* unless --allow-live is passed.
 */

import { config } from "dotenv";
import { resolve } from "path";
import type Stripe from "stripe";
import { STRIPE_PAID_PLAN_IDS } from "@/lib/billing-plan-ids";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const MANAGEABLE_STATUSES = new Set(["active", "trialing", "past_due"]);

type CliOptions = {
  email: string | null;
  userId: string | null;
  scanAll: boolean;
  execute: boolean;
  refund: boolean;
  allowLive: boolean;
  keepSubscriptionId: string | null;
};

type ReconcileGroup = {
  label: string;
  customerId: string;
  clerkUserId: string | null;
  manageable: Stripe.Subscription[];
};

function parseArgs(argv: string[]): CliOptions {
  const emailArg = argv.find((a) => a.startsWith("--email="));
  const userArg = argv.find((a) => a.startsWith("--user="));
  const keepArg = argv.find((a) => a.startsWith("--keep="));

  const email = emailArg ? emailArg.slice("--email=".length).trim().toLowerCase() : null;
  const userId = userArg ? userArg.slice("--user=".length).trim() : null;
  const scanAll = argv.includes("--all");

  if (!email && !userId && !scanAll) {
    console.error(
      [
        "Usage:",
        "  npx tsx scripts/reconcile-duplicate-stripe-subs.ts --email=<email>",
        "  npx tsx scripts/reconcile-duplicate-stripe-subs.ts --user=<clerkUserId>",
        "  npx tsx scripts/reconcile-duplicate-stripe-subs.ts --all",
        "",
        "Options: --execute  --refund  --keep=sub_xxx  --allow-live",
      ].join("\n"),
    );
    process.exit(1);
  }

  return {
    email,
    userId,
    scanAll,
    execute: argv.includes("--execute"),
    refund: argv.includes("--refund"),
    allowLive: argv.includes("--allow-live"),
    keepSubscriptionId: keepArg ? keepArg.slice("--keep=".length).trim() : null,
  };
}

function stripeKeyMode(value: string): "test" | "live" | "unknown" {
  if (value.startsWith("sk_test_")) return "test";
  if (value.startsWith("sk_live_")) return "live";
  return "unknown";
}

function planRank(planSlug: string | undefined): number {
  const slug = planSlug?.trim() ?? "";
  const idx = (STRIPE_PAID_PLAN_IDS as readonly string[]).indexOf(slug);
  return idx >= 0 ? idx : -1;
}

function formatMoney(cents: number, currency: string): string {
  return `${(Math.abs(cents) / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function subSummary(sub: Stripe.Subscription): string {
  const created = new Date(sub.created * 1000).toISOString();
  const plan = sub.metadata?.plan ?? "—";
  const clerkUserId = sub.metadata?.clerkUserId ?? "—";
  return `${sub.id} | ${sub.status} | plan=${plan} | clerkUserId=${clerkUserId} | created=${created}`;
}

function pickKeeperSubscription(
  subs: Stripe.Subscription[],
  forcedId: string | null,
): Stripe.Subscription {
  if (forcedId) {
    const found = subs.find((s) => s.id === forcedId);
    if (!found) {
      throw new Error(`--keep=${forcedId} not found among manageable subscriptions.`);
    }
    return found;
  }

  return [...subs].sort((a, b) => {
    const rankDiff = planRank(b.metadata?.plan) - planRank(a.metadata?.plan);
    if (rankDiff !== 0) return rankDiff;
    return b.created - a.created;
  })[0]!;
}

async function listManageableSubscriptions(
  stripe: Stripe,
  customerId: string,
): Promise<Stripe.Subscription[]> {
  const listed = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });
  return listed.data.filter((s) => MANAGEABLE_STATUSES.has(s.status));
}

async function findCustomersByEmail(
  stripe: Stripe,
  email: string,
): Promise<Stripe.Customer[]> {
  const escaped = email.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  try {
    const result = await stripe.customers.search({
      query: `email:'${escaped}'`,
      limit: 20,
    });
    return result.data.filter((c) => !c.deleted);
  } catch {
    const listed = await stripe.customers.list({ email, limit: 20 });
    return listed.data.filter((c) => !c.deleted);
  }
}

async function paymentIntentIdFromPaidInvoice(
  stripe: Stripe,
  invoiceId: string,
): Promise<string | null> {
  const inv = await stripe.invoices.retrieve(invoiceId, {
    expand: ["payments.data.payment.payment_intent"],
  });

  const refs = inv as Stripe.Invoice & {
    payment_intent?: string | { id?: string } | null;
  };
  const legacyPaymentIntent =
    typeof refs.payment_intent === "string"
      ? refs.payment_intent
      : refs.payment_intent && typeof refs.payment_intent === "object"
        ? refs.payment_intent.id ?? null
        : null;
  if (legacyPaymentIntent) return legacyPaymentIntent;

  for (const entry of inv.payments?.data ?? []) {
    const payment = entry.payment as
      | { type?: string; payment_intent?: string | { id?: string } }
      | undefined;
    if (payment?.type !== "payment_intent") continue;
    const pi = payment.payment_intent;
    if (typeof pi === "string") return pi;
    if (pi && typeof pi === "object" && typeof pi.id === "string") return pi.id;
  }
  return null;
}

async function refundLatestPaidInvoiceForSubscription(
  stripe: Stripe,
  subscriptionId: string,
): Promise<{ refunded: boolean; amountCents?: number; currency?: string; reason?: string }> {
  const invoices = await stripe.invoices.list({
    subscription: subscriptionId,
    limit: 10,
  });

  const paid = invoices.data.find(
    (inv) =>
      inv.status === "paid" &&
      typeof inv.amount_paid === "number" &&
      inv.amount_paid > 0,
  );
  if (!paid?.id) {
    return { refunded: false, reason: "no paid invoice found" };
  }

  const paidRefs = paid as Stripe.Invoice & {
    charge?: string | { id?: string } | null;
  };
  const chargeId =
    typeof paidRefs.charge === "string"
      ? paidRefs.charge
      : paidRefs.charge && typeof paidRefs.charge === "object"
        ? paidRefs.charge.id ?? null
        : null;

  const refundParams = {
    reason: "duplicate" as const,
    metadata: {
      reason: "duplicate_subscription_reconcile",
      subscriptionId,
    },
  };

  if (chargeId) {
    const refund = await stripe.refunds.create({ charge: chargeId, ...refundParams });
    return {
      refunded: refund.status === "succeeded" || refund.status === "pending",
      amountCents: paid.amount_paid,
      currency: paid.currency,
    };
  }

  const paymentIntentId = await paymentIntentIdFromPaidInvoice(stripe, paid.id);
  if (!paymentIntentId) {
    return { refunded: false, reason: "paid invoice has no charge or payment_intent" };
  }

  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    ...refundParams,
  });
  return {
    refunded: refund.status === "succeeded" || refund.status === "pending",
    amountCents: paid.amount_paid,
    currency: paid.currency,
  };
}

async function syncKeeperToApp(keeper: Stripe.Subscription): Promise<void> {
  const clerkUserId = keeper.metadata?.clerkUserId?.trim();
  if (!clerkUserId) {
    console.log("    (skip app sync — keeper has no clerkUserId metadata)");
    return;
  }

  const { syncActiveSubscriptionFromStripeForUser } = await import(
    "@/lib/stripe-billing-sync"
  );
  const { syncRecentStripeInvoicesForUser } = await import(
    "@/lib/stripe-invoice-persist"
  );
  const customerId =
    typeof keeper.customer === "string" ? keeper.customer : keeper.customer?.id;

  const result = await syncActiveSubscriptionFromStripeForUser(clerkUserId);
  console.log(`    Clerk + DB sync:`, result);

  if (customerId) {
    try {
      await syncRecentStripeInvoicesForUser(clerkUserId, {
        customerId,
        limit: 12,
      });
      console.log("    Invoice backfill: ok");
    } catch (error) {
      console.error("    Invoice backfill failed:", error);
    }
  }
}

async function buildGroupsForEmail(
  stripe: Stripe,
  email: string,
): Promise<ReconcileGroup[]> {
  const customers = await findCustomersByEmail(stripe, email);
  const groups: ReconcileGroup[] = [];

  for (const customer of customers) {
    const manageable = await listManageableSubscriptions(stripe, customer.id);
    if (manageable.length === 0) continue;
    groups.push({
      label: `email:${email} customer:${customer.id}`,
      customerId: customer.id,
      clerkUserId: customer.metadata?.clerkUserId?.trim() ?? null,
      manageable,
    });
  }

  return groups;
}

async function buildGroupsForUser(
  stripe: Stripe,
  userId: string,
): Promise<ReconcileGroup[]> {
  const { findActiveSubscriptionForClerkUser } = await import(
    "@/lib/stripe-billing-sync"
  );
  const located = await findActiveSubscriptionForClerkUser(userId);
  if (!located) {
    console.error(`No Stripe customer/subscription found for Clerk user ${userId}.`);
    process.exit(1);
  }

  const manageable = await listManageableSubscriptions(stripe, located.customerId);
  return [
    {
      label: `user:${userId}`,
      customerId: located.customerId,
      clerkUserId: userId,
      manageable,
    },
  ];
}

async function buildGroupsForAllDbCustomers(
  stripe: Stripe,
): Promise<ReconcileGroup[]> {
  const { db } = await import("@/db");
  const { stripeSubscriptions } = await import("@/db/schema");

  let rows: { userId: string; stripeCustomerId: string }[] = [];
  try {
    rows = await db
      .select({
        userId: stripeSubscriptions.userId,
        stripeCustomerId: stripeSubscriptions.stripeCustomerId,
      })
      .from(stripeSubscriptions);
  } catch (error) {
    console.error("Could not read stripe_subscriptions table:", error);
    process.exit(1);
  }

  const byCustomer = new Map<string, { userId: string }>();
  for (const row of rows) {
    if (!byCustomer.has(row.stripeCustomerId)) {
      byCustomer.set(row.stripeCustomerId, { userId: row.userId });
    }
  }

  const groups: ReconcileGroup[] = [];
  for (const [customerId, meta] of byCustomer.entries()) {
    const manageable = await listManageableSubscriptions(stripe, customerId);
    if (manageable.length <= 1) continue;
    groups.push({
      label: `customer:${customerId} (db user ${meta.userId})`,
      customerId,
      clerkUserId: meta.userId,
      manageable,
    });
  }

  return groups;
}

async function reconcileGroup(
  stripe: Stripe,
  group: ReconcileGroup,
  options: CliOptions,
): Promise<boolean> {
  if (group.manageable.length <= 1) {
    return false;
  }

  const keeper = pickKeeperSubscription(group.manageable, options.keepSubscriptionId);
  const toCancel = group.manageable.filter((s) => s.id !== keeper.id);

  console.log(`\n=== ${group.label} ===`);
  console.log(`Manageable subscriptions (${group.manageable.length}):`);
  for (const sub of group.manageable) {
    console.log(`  - ${subSummary(sub)}`);
  }
  console.log(`Keeper (highest tier, then newest): ${subSummary(keeper)}`);
  console.log(`Cancel (${toCancel.length}):`);
  for (const sub of toCancel) {
    console.log(`  - ${subSummary(sub)}`);
  }

  if (!options.execute) {
    return true;
  }

  const { cancelOtherActiveSubscriptionsForCustomer } = await import(
    "@/lib/apply-plan-upgrade"
  );
  await cancelOtherActiveSubscriptionsForCustomer(group.customerId, keeper.id);
  console.log("  Canceled duplicates via Stripe API.");

  if (options.refund) {
    for (const sub of toCancel) {
      try {
        const refundResult = await refundLatestPaidInvoiceForSubscription(stripe, sub.id);
        if (refundResult.refunded && refundResult.amountCents != null && refundResult.currency) {
          console.log(
            `  Refunded ${formatMoney(refundResult.amountCents, refundResult.currency)} for ${sub.id}`,
          );
        } else {
          console.log(`  No refund for ${sub.id}: ${refundResult.reason ?? "unknown"}`);
        }
      } catch (error) {
        console.error(`  Refund failed for ${sub.id}:`, error);
      }
    }
  }

  try {
    await syncKeeperToApp(keeper);
  } catch (error) {
    console.error("  App sync failed (Stripe cancellations still applied):", error);
  }

  return true;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    console.error("Missing STRIPE_SECRET_KEY in .env.local");
    process.exit(1);
  }

  const mode = stripeKeyMode(secretKey);
  if (mode === "live" && !options.allowLive) {
    console.error(
      "Refusing to run against live Stripe. Use test keys or pass --allow-live explicitly.",
    );
    process.exit(1);
  }
  if (mode === "unknown") {
    console.error("STRIPE_SECRET_KEY must start with sk_test_ or sk_live_.");
    process.exit(1);
  }

  const { stripe } = await import("@/lib/stripe");

  console.log(`Stripe mode: ${mode}`);
  console.log(`Run mode: ${options.execute ? "EXECUTE" : "DRY RUN (pass --execute to apply)"}`);
  if (options.refund) console.log("Refunds: enabled for canceled duplicate subs");

  let groups: ReconcileGroup[] = [];
  if (options.email) {
    groups = await buildGroupsForEmail(stripe, options.email);
  } else if (options.userId) {
    groups = await buildGroupsForUser(stripe, options.userId);
  } else {
    groups = await buildGroupsForAllDbCustomers(stripe);
  }

  if (groups.length === 0) {
    console.log("\nNo Stripe customers with manageable subscriptions found.");
    return;
  }

  let duplicateGroups = 0;
  for (const group of groups) {
    const hadDuplicates = await reconcileGroup(stripe, group, options);
    if (hadDuplicates) duplicateGroups += 1;
  }

  if (duplicateGroups === 0) {
    console.log("\nNo duplicate active subscriptions found.");
    return;
  }

  if (!options.execute) {
    console.log(
      `\nDry run complete — ${duplicateGroups} customer(s) with duplicates.` +
        "\nRe-run with --execute to cancel extras and sync Clerk/DB/invoices." +
        (options.refund ? "" : "\nAdd --refund to refund the latest paid invoice on each canceled sub."),
    );
  } else {
    console.log(`\nDone — reconciled ${duplicateGroups} customer(s).`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
