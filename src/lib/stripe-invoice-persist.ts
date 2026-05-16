import { createClerkClient } from "@clerk/backend";
import type Stripe from "stripe";
import { upsertBillingInvoiceRecord } from "@/db/queries/billing";
import { replaceProrationLinesForStripeInvoice } from "@/db/queries/billing-proration";
import { stripe } from "@/lib/stripe";
import { asPaidPlanId } from "@/lib/stripe-billing-sync";
import type { StripePaidPlanId } from "@/lib/billing-plan-ids";
import { planSlugFromStripeLineDescription } from "@/lib/stripe-receipt-plan-title";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function invoiceAmountCents(invoice: Stripe.Invoice): number | null {
  if (typeof invoice.amount_paid === "number") return invoice.amount_paid;
  if (typeof invoice.amount_due === "number") return invoice.amount_due;
  if (typeof invoice.total === "number") return invoice.total;
  return null;
}

function invoiceSubtotalCents(invoice: Stripe.Invoice): number | null {
  if (typeof invoice.subtotal === "number") return invoice.subtotal;
  return null;
}

function invoiceDiscountCents(invoice: Stripe.Invoice): number | null {
  const raw = invoice as unknown as Record<string, unknown>;
  if (Array.isArray(raw.total_discount_amounts) && raw.total_discount_amounts.length > 0) {
    const sum = (raw.total_discount_amounts as { amount?: number }[]).reduce(
      (acc, entry) => acc + (entry.amount ?? 0),
      0,
    );
    return sum > 0 ? sum : null;
  }
  return null;
}

function invoiceDiscountLabel(invoice: Stripe.Invoice): string | null {
  const raw = invoice as unknown as Record<string, unknown>;
  const discounts = Array.isArray(raw.total_discount_amounts)
    ? (raw.total_discount_amounts as { discount?: Record<string, unknown> }[])
    : [];

  for (const entry of discounts) {
    const coupon = entry.discount?.coupon as Record<string, unknown> | undefined;
    if (!coupon) continue;
    const name = typeof coupon.name === "string" ? coupon.name.trim() : "";
    const id = typeof coupon.id === "string" ? coupon.id.trim() : "";
    const label = name || id;
    if (!label) continue;
    if (coupon.percent_off != null) {
      return `${label} — ${coupon.percent_off}% off`;
    }
    if (typeof coupon.amount_off === "number" && typeof coupon.currency === "string") {
      return `${label} — $${(coupon.amount_off / 100).toFixed(2)} off`;
    }
    return label;
  }
  return null;
}

function invoiceTaxCents(invoice: Stripe.Invoice): number | null {
  const raw = invoice as unknown as Record<string, unknown>;
  if (typeof raw.tax === "number") return raw.tax > 0 ? raw.tax : null;
  if (Array.isArray(raw.total_tax_amounts) && raw.total_tax_amounts.length > 0) {
    const sum = (raw.total_tax_amounts as { amount?: number }[]).reduce(
      (acc, entry) => acc + (entry.amount ?? 0),
      0,
    );
    return sum > 0 ? sum : null;
  }
  if (typeof invoice.total === "number" && typeof invoice.subtotal === "number") {
    const diff = invoice.total - invoice.subtotal;
    return diff > 0 ? diff : null;
  }
  return null;
}

async function resolvePaidPlanFromCustomer(customerId: string): Promise<StripePaidPlanId | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return null;
    return asPaidPlanId(customer.metadata?.plan);
  } catch {
    return null;
  }
}

function resolvePlanSlugFromInvoiceLines(
  invoice: Stripe.Invoice,
): StripePaidPlanId | null {
  const lines = invoice.lines?.data ?? [];
  for (const line of lines) {
    if ((line as { proration?: boolean }).proration) continue;
    const fromDesc = planSlugFromStripeLineDescription(line.description);
    if (fromDesc) return fromDesc;
  }
  for (const line of lines) {
    const fromDesc = planSlugFromStripeLineDescription(line.description);
    if (fromDesc) return fromDesc;
  }
  return null;
}

async function resolvePlanSlugForInvoice(
  invoice: Stripe.Invoice,
): Promise<StripePaidPlanId> {
  const fromLines = resolvePlanSlugFromInvoiceLines(invoice);
  if (fromLines) return fromLines;

  const fromMeta = asPaidPlanId(invoice.metadata?.plan);
  if (fromMeta) return fromMeta;

  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (customerId) {
    const fromCustomer = await resolvePaidPlanFromCustomer(customerId);
    if (fromCustomer) return fromCustomer;
  }

  return "pro";
}

/** Persists one Stripe invoice + proration lines (same shape as the Stripe webhook). */
export async function persistStripeInvoiceForUser(
  userId: string,
  userEmail: string | null,
  invoice: Stripe.Invoice,
): Promise<void> {
  const invoicePlan = await resolvePlanSlugForInvoice(invoice);

  const raw = invoice as unknown as Record<string, unknown>;
  const firstLine = invoice.lines?.data?.[0];
  const lineStart =
    typeof firstLine?.period?.start === "number" ? firstLine.period.start : null;
  const lineEnd =
    typeof firstLine?.period?.end === "number" ? firstLine.period.end : null;
  const topStart =
    typeof raw.period_start === "number" ? (raw.period_start as number) : null;
  const topEnd =
    typeof raw.period_end === "number" ? (raw.period_end as number) : null;

  const invoicePeriodStart =
    lineStart != null
      ? new Date(lineStart * 1000)
      : topStart != null
        ? new Date(topStart * 1000)
        : null;
  const invoicePeriodEnd =
    lineEnd != null
      ? new Date(lineEnd * 1000)
      : topEnd != null
        ? new Date(topEnd * 1000)
        : null;

  await upsertBillingInvoiceRecord({
    externalId: invoice.id,
    source: "invoice",
    userId,
    userEmail,
    planSlug: invoicePlan,
    invoiceNumber: stringOrNull(invoice.number),
    status: invoice.status ?? "unknown",
    amountCents: invoiceAmountCents(invoice),
    subtotalCents: invoiceSubtotalCents(invoice),
    taxAmountCents: invoiceTaxCents(invoice),
    currency: stringOrNull(invoice.currency),
    hostedInvoiceUrl: stringOrNull(invoice.hosted_invoice_url),
    invoicePdfUrl: stringOrNull(invoice.invoice_pdf),
    periodStart: invoicePeriodStart,
    periodEnd: invoicePeriodEnd,
    paidAt:
      typeof invoice.status_transitions?.paid_at === "number"
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : null,
    discountAmountCents: invoiceDiscountCents(invoice),
    discountLabel: invoiceDiscountLabel(invoice),
    stripeBillingReason: stringOrNull(invoice.billing_reason),
  });

  const currency = stringOrNull(invoice.currency);
  const prorationPayload: Array<{
    stripeLineId: string;
    amountCents: number | null;
    currency: string | null;
    description: string | null;
    periodStart: Date | null;
    periodEnd: Date | null;
  }> = [];

  for (const line of invoice.lines?.data ?? []) {
    const isProration = Boolean((line as { proration?: boolean }).proration);
    if (!isProration) continue;
    const period = line.period;
    prorationPayload.push({
      stripeLineId: line.id,
      amountCents: typeof line.amount === "number" ? line.amount : null,
      currency,
      description: stringOrNull(line.description),
      periodStart:
        typeof period?.start === "number" ? new Date(period.start * 1000) : null,
      periodEnd:
        typeof period?.end === "number" ? new Date(period.end * 1000) : null,
    });
  }

  if (prorationPayload.length > 0) {
    await replaceProrationLinesForStripeInvoice({
      userId,
      stripeInvoiceId: invoice.id,
      lines: prorationPayload,
    });
  }
}

async function resolveUserEmail(userId: string): Promise<string | null> {
  try {
    const user = await clerkClient.users.getUser(userId);
    return (
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress?.toLowerCase() ?? null
    );
  } catch {
    return null;
  }
}

/**
 * Backfills recent Stripe invoices into `billing_invoices` + `billing_proration_lines`
 * so Plan History shows proration without relying on webhooks (local dev / in-place upgrades).
 */
export async function syncRecentStripeInvoicesForUser(
  userId: string,
  options?: { customerId?: string; limit?: number },
): Promise<void> {
  let customerId = options?.customerId;
  if (!customerId) {
    const customers = await stripe.customers.search({
      query: `metadata['clerkUserId']:'${userId}'`,
      limit: 1,
    });
    customerId = customers.data[0]?.id;
  }
  if (!customerId) return;

  const email = await resolveUserEmail(userId);
  const limit = options?.limit ?? 24;

  const listed = await stripe.invoices.list({
    customer: customerId,
    limit,
  });

  for (const invoice of listed.data) {
    try {
      await persistStripeInvoiceForUser(userId, email, invoice);
    } catch (error) {
      console.error("[syncRecentStripeInvoicesForUser]", invoice.id, error);
    }
  }
}
