import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";

export type ProratedRefundEstimate = {
  refundCents: number;
  currency: string;
  planSlug: string | null;
};

function subscriptionPeriodBounds(sub: Stripe.Subscription): {
  periodStart: number;
  periodEnd: number;
} | null {
  const item = sub.items.data[0];
  if (!item) return null;
  const itemAny = item as Stripe.SubscriptionItem & {
    current_period_start?: number;
    current_period_end?: number;
  };
  const periodStart = itemAny.current_period_start;
  const periodEnd = itemAny.current_period_end;
  if (
    typeof periodStart !== "number" ||
    typeof periodEnd !== "number" ||
    periodEnd <= periodStart
  ) {
    return null;
  }
  return { periodStart, periodEnd };
}

async function resolvePaidInvoice(
  sub: Stripe.Subscription,
): Promise<Stripe.Invoice | null> {
  const latest = sub.latest_invoice;
  if (latest && typeof latest === "object") {
    if (latest.status === "paid" && latest.amount_paid > 0) return latest;
  } else if (typeof latest === "string") {
    const inv = await stripe.invoices.retrieve(latest);
    if (inv.status === "paid" && inv.amount_paid > 0) return inv;
  }

  const list = await stripe.invoices.list({
    subscription: sub.id,
    status: "paid",
    limit: 1,
  });
  return list.data[0] ?? null;
}

function proratedRefundCentsFromInvoice(
  invoice: Stripe.Invoice,
  periodStart: number,
  periodEnd: number,
  nowSec: number,
): number {
  const totalPeriod = periodEnd - periodStart;
  if (totalPeriod <= 0) return 0;
  const remaining = Math.max(0, periodEnd - nowSec);
  const ratio = Math.min(1, remaining / totalPeriod);
  return Math.max(0, Math.min(invoice.amount_paid, Math.round(invoice.amount_paid * ratio)));
}

/** Read-only estimate for the delete-account confirmation UI. */
export async function estimateProratedRefundForSubscription(
  stripeSubscriptionId: string,
  planSlug: string | null,
): Promise<ProratedRefundEstimate | null> {
  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ["latest_invoice"],
  });
  if (sub.status !== "active" && sub.status !== "trialing") return null;
  if (sub.status === "trialing") {
    return { refundCents: 0, currency: "usd", planSlug };
  }

  const bounds = subscriptionPeriodBounds(sub);
  if (!bounds) return { refundCents: 0, currency: "usd", planSlug };

  const invoice = await resolvePaidInvoice(sub);
  if (!invoice?.currency) return { refundCents: 0, currency: "usd", planSlug };

  const refundCents = proratedRefundCentsFromInvoice(
    invoice,
    bounds.periodStart,
    bounds.periodEnd,
    Math.floor(Date.now() / 1000),
  );
  return { refundCents, currency: invoice.currency, planSlug };
}

type InvoicePaymentRefs = {
  charge?: string | { id: string } | null;
  payment_intent?: string | { id: string } | null;
};

async function issueRefundForInvoice(
  invoice: Stripe.Invoice,
  refundCents: number,
): Promise<void> {
  if (refundCents <= 0) return;

  const refs = invoice as Stripe.Invoice & InvoicePaymentRefs;
  const charge =
    typeof refs.charge === "string"
      ? refs.charge
      : refs.charge && typeof refs.charge === "object"
        ? refs.charge.id
        : null;

  if (charge) {
    await stripe.refunds.create({
      charge,
      amount: refundCents,
      reason: "requested_by_customer",
      metadata: { reason: "account_deletion_proration" },
    });
    return;
  }

  const paymentIntent =
    typeof refs.payment_intent === "string"
      ? refs.payment_intent
      : refs.payment_intent && typeof refs.payment_intent === "object"
        ? refs.payment_intent.id
        : null;

  if (paymentIntent) {
    await stripe.refunds.create({
      payment_intent: paymentIntent,
      amount: refundCents,
      reason: "requested_by_customer",
      metadata: { reason: "account_deletion_proration" },
    });
    return;
  }

  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer && typeof invoice.customer === "object"
        ? invoice.customer.id
        : null;
  if (!customerId) return;

  const charges = await stripe.charges.list({ customer: customerId, limit: 20 });
  const latestPaid = charges.data.find((c) => c.paid && !c.refunded);
  if (latestPaid) {
    await stripe.refunds.create({
      charge: latestPaid.id,
      amount: refundCents,
      reason: "requested_by_customer",
      metadata: { reason: "account_deletion_proration" },
    });
  }
}

/**
 * Cancels an active/trialing subscription and refunds unused paid time (prorated).
 * No-op refund when trialing, unpaid, or no charge on file.
 */
export async function cancelSubscriptionWithProratedRefund(
  stripeSubscriptionId: string,
): Promise<ProratedRefundEstimate> {
  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ["latest_invoice"],
  });

  if (sub.status !== "active" && sub.status !== "trialing") {
    await stripe.subscriptions.cancel(stripeSubscriptionId);
    return { refundCents: 0, currency: "usd", planSlug: null };
  }

  if (sub.status === "trialing") {
    await stripe.subscriptions.cancel(stripeSubscriptionId);
    return { refundCents: 0, currency: "usd", planSlug: null };
  }

  const bounds = subscriptionPeriodBounds(sub);
  const invoice = bounds ? await resolvePaidInvoice(sub) : null;
  const nowSec = Math.floor(Date.now() / 1000);
  const refundCents =
    bounds && invoice
      ? proratedRefundCentsFromInvoice(
          invoice,
          bounds.periodStart,
          bounds.periodEnd,
          nowSec,
        )
      : 0;
  const currency = invoice?.currency ?? "usd";

  await stripe.subscriptions.cancel(stripeSubscriptionId);

  if (invoice && refundCents > 0) {
    await issueRefundForInvoice(invoice, refundCents);
  }

  return { refundCents, currency, planSlug: null };
}
