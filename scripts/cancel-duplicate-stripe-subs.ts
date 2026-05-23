/**
 * Cancel duplicate active Stripe subscriptions for one customer email.
 * Keeps the newest active/trialing/past_due subscription unless --keep=sub_xxx is set.
 *
 * Usage:
 *   npx tsx scripts/cancel-duplicate-stripe-subs.ts jammi008@gmail.com
 *   npx tsx scripts/cancel-duplicate-stripe-subs.ts jammi008@gmail.com --execute
 *   npx tsx scripts/cancel-duplicate-stripe-subs.ts jammi008@gmail.com --execute --refund
 *
 * Defaults to dry-run. Requires sk_test_* unless --allow-live is passed.
 */

import { config } from "dotenv";
import { resolve } from "path";
import type Stripe from "stripe";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const MANAGEABLE_STATUSES = new Set(["active", "trialing", "past_due"]);

type CliOptions = {
  email: string;
  execute: boolean;
  refund: boolean;
  allowLive: boolean;
  keepSubscriptionId: string | null;
};

function parseArgs(argv: string[]): CliOptions {
  const positional = argv.filter((a) => !a.startsWith("--"));
  const email = positional[0]?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error(
      "Usage: npx tsx scripts/cancel-duplicate-stripe-subs.ts <email> [--execute] [--refund] [--keep=sub_xxx] [--allow-live]",
    );
    process.exit(1);
  }

  const keepArg = argv.find((a) => a.startsWith("--keep="));
  const keepSubscriptionId = keepArg ? keepArg.slice("--keep=".length).trim() : null;

  return {
    email,
    execute: argv.includes("--execute"),
    refund: argv.includes("--refund"),
    allowLive: argv.includes("--allow-live"),
    keepSubscriptionId: keepSubscriptionId || null,
  };
}

function stripeKeyMode(value: string): "test" | "live" | "unknown" {
  if (value.startsWith("sk_test_")) return "test";
  if (value.startsWith("sk_live_")) return "live";
  return "unknown";
}

function formatMoney(cents: number, currency: string): string {
  const amount = (Math.abs(cents) / 100).toFixed(2);
  return `${amount} ${currency.toUpperCase()}`;
}

function subSummary(sub: Stripe.Subscription): string {
  const created = new Date(sub.created * 1000).toISOString();
  const plan = sub.metadata?.plan ?? "—";
  const clerkUserId = sub.metadata?.clerkUserId ?? "—";
  return `${sub.id} | ${sub.status} | plan=${plan} | clerkUserId=${clerkUserId} | created=${created}`;
}

async function findCustomersByEmail(
  stripe: Stripe,
  email: string,
): Promise<Stripe.Customer[]> {
  const escaped = email.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const result = await stripe.customers.search({
    query: `email:'${escaped}'`,
    limit: 20,
  });
  return result.data.filter((c) => !c.deleted);
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

  const payments = inv.payments?.data ?? [];
  for (const entry of payments) {
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

  const chargeId =
    typeof paid.charge === "string" ? paid.charge : paid.charge?.id ?? null;

  const refundParams = {
    reason: "duplicate" as const,
    metadata: {
      reason: "duplicate_subscription_cleanup",
      subscriptionId,
    },
  };

  if (chargeId) {
    const refund = await stripe.refunds.create({
      charge: chargeId,
      ...refundParams,
    });
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

async function syncKeeperToApp(
  stripe: Stripe,
  keeper: Stripe.Subscription,
): Promise<void> {
  const clerkUserId = keeper.metadata?.clerkUserId?.trim();
  if (!clerkUserId) {
    console.log("  (skip DB/Clerk sync — keeper subscription has no clerkUserId metadata)");
    return;
  }

  const { syncActiveSubscriptionFromStripeForUser } = await import(
    "@/lib/stripe-billing-sync"
  );
  const result = await syncActiveSubscriptionFromStripeForUser(clerkUserId);
  console.log(`  Synced Clerk + DB for ${clerkUserId}:`, result);
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
  console.log(`Email: ${options.email}`);
  console.log(`Mode: ${options.execute ? "EXECUTE" : "DRY RUN (pass --execute to apply)"}\n`);

  const customers = await findCustomersByEmail(stripe, options.email);
  if (customers.length === 0) {
    console.error("No Stripe customer found for that email.");
    process.exit(1);
  }

  const allManageable: Stripe.Subscription[] = [];
  for (const customer of customers) {
    console.log(`Customer ${customer.id} (${customer.email ?? "no email"})`);
    const subs = await listManageableSubscriptions(stripe, customer.id);
    for (const sub of subs) {
      console.log(`  - ${subSummary(sub)}`);
      allManageable.push(sub);
    }
  }

  if (allManageable.length <= 1) {
    console.log(
      allManageable.length === 0
        ? "\nNo active/trialing/past_due subscriptions to dedupe."
        : "\nOnly one manageable subscription — nothing to cancel.",
    );
    return;
  }

  let keeper: Stripe.Subscription;
  if (options.keepSubscriptionId) {
    const found = allManageable.find((s) => s.id === options.keepSubscriptionId);
    if (!found) {
      console.error(`--keep=${options.keepSubscriptionId} not found among manageable subs.`);
      process.exit(1);
    }
    keeper = found;
  } else {
    keeper = [...allManageable].sort((a, b) => b.created - a.created)[0]!;
  }

  const toCancel = allManageable.filter((s) => s.id !== keeper.id);

  console.log(`\nKeeper: ${subSummary(keeper)}`);
  console.log(`Duplicates to cancel (${toCancel.length}):`);
  for (const sub of toCancel) {
    console.log(`  - ${subSummary(sub)}`);
  }

  if (!options.execute) {
    console.log(
      "\nDry run only. Re-run with --execute to cancel duplicates" +
        (options.refund ? " and --refund to refund their latest paid invoice" : "") +
        ".",
    );
    return;
  }

  console.log("\nApplying changes...");
  for (const sub of toCancel) {
    await stripe.subscriptions.cancel(sub.id);
    console.log(`  Canceled ${sub.id}`);

    if (options.refund) {
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
    await syncKeeperToApp(stripe, keeper);
  } catch (error) {
    console.error("  Clerk/DB sync failed (Stripe cancellations still applied):", error);
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
