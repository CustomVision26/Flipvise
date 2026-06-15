import { createClerkClient } from "@clerk/backend";
import type Stripe from "stripe";
import {
  getActiveStripeSubscription,
  getManageableStripeSubscription,
} from "@/db/queries/stripe-subscriptions";
import {
  normalizeAdminInvoicePromoKind,
  normalizeBillingInvoiceDiscountLabel,
  parsePromoFromDiscountLabel,
  formatUserInvoicePromoDisplay,
  type AdminInvoicePromoKind,
} from "@/lib/admin-invoice-promo-display";
import { stampStripeCouponInvoiceLabel } from "@/lib/stripe-checkout-discount";
import {
  listBillingInvoicesForUser,
  upsertBillingInvoiceRecord,
} from "@/db/queries/billing";
import { replaceProrationLinesForStripeInvoice } from "@/db/queries/billing-proration";
import { stripe } from "@/lib/stripe";
import { isStripeCheckoutSessionId } from "@/lib/stripe-checkout-session-id";
import { asPaidPlanId, upsertStripeSubscriptionFromStripeSub } from "@/lib/stripe-billing-sync";
import type { StripePaidPlanId } from "@/lib/billing-plan-ids";
import { planSlugFromStripeLineDescription } from "@/lib/stripe-receipt-plan-title";
import { readPlansConfigFromDisk } from "@/lib/plans-config-disk";
import {
  resolveCheckoutSessionChargeReceiptUrl,
  resolveStripeInvoiceReceiptUrls,
} from "@/lib/stripe-invoice-receipt-url";

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

function invoiceCouponFromInvoice(
  invoice: Stripe.Invoice,
): Record<string, unknown> | null {
  const raw = invoice as unknown as Record<string, unknown>;
  const discounts = Array.isArray(raw.total_discount_amounts)
    ? (raw.total_discount_amounts as { discount?: Record<string, unknown> }[])
    : [];

  for (const entry of discounts) {
    const discount = entry.discount;
    const coupon =
      (discount?.coupon as Record<string, unknown> | undefined) ??
      (typeof discount?.source === "object" &&
      discount.source !== null &&
      (discount.source as { coupon?: Record<string, unknown> }).coupon
        ? (discount.source as { coupon: Record<string, unknown> }).coupon
        : undefined);
    if (coupon) return coupon;
  }

  const invoiceDiscounts = Array.isArray(raw.discounts)
    ? (raw.discounts as { coupon?: Record<string, unknown> | string }[])
    : [];
  for (const entry of invoiceDiscounts) {
    const couponRef = entry.coupon;
    if (couponRef && typeof couponRef === "object") return couponRef;
  }

  const legacyDiscount = raw.discount as
    | { coupon?: Record<string, unknown> }
    | undefined;
  if (legacyDiscount?.coupon && typeof legacyDiscount.coupon === "object") {
    return legacyDiscount.coupon;
  }

  return null;
}

function invoiceCouponPercentOff(invoice: Stripe.Invoice): number | null {
  const coupon = invoiceCouponFromInvoice(invoice);
  if (coupon && typeof coupon.percent_off === "number" && coupon.percent_off > 0) {
    return Math.round(coupon.percent_off);
  }
  return null;
}

function invoiceCouponId(invoice: Stripe.Invoice): string | null {
  const coupon = invoiceCouponFromInvoice(invoice);
  if (coupon && typeof coupon.id === "string" && coupon.id.trim()) {
    return coupon.id.trim();
  }
  return null;
}

function invoiceDiscountLabel(invoice: Stripe.Invoice): string | null {
  const coupon = invoiceCouponFromInvoice(invoice);
  if (!coupon) return null;

  const name = typeof coupon.name === "string" ? coupon.name.trim() : "";
  const id = typeof coupon.id === "string" ? coupon.id.trim() : "";
  const label = name || id;
  if (!label) return null;

  if (/\(General Discount \d+%\)/i.test(label)) return label;
  if (/\(affiliate \d+% off\)/i.test(label)) return label;
  if (/\(general \d+% off\)/i.test(label)) return label;

  if (coupon.percent_off != null) {
    if (/\d+%\s*off/i.test(label)) return label;
    return `${label} — ${coupon.percent_off}% off`;
  }
  if (typeof coupon.amount_off === "number" && typeof coupon.currency === "string") {
    return `${label} — $${(coupon.amount_off / 100).toFixed(2)} off`;
  }
  return label;
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

async function resolvePromoPercentFromPlanConfig(input: {
  promoCode: string;
  promoKind: AdminInvoicePromoKind;
  planSlug: StripePaidPlanId;
}): Promise<number | null> {
  try {
    const plans = await readPlansConfigFromDisk();
    const plan = plans.find((p) => p.id === input.planSlug);
    if (!plan) return null;

    const codeLower = input.promoCode.trim().toLowerCase();
    if (input.promoKind === "general") {
      const base = plan.discount?.stripeCouponId?.trim().toLowerCase();
      if (base && (codeLower === base || codeLower.startsWith(base))) {
        const value = plan.discount?.value;
        return typeof value === "number" && value > 0 ? Math.round(value) : null;
      }
    }

    if (input.promoKind === "affiliate") {
      const value = plan.affiliateDiscount?.value;
      return typeof value === "number" && value > 0 ? Math.round(value) : null;
    }
  } catch (error) {
    console.error("[resolvePromoPercentFromPlanConfig]", error);
  }
  return null;
}

async function resolveInvoicePromoFromStripe(
  invoice: Stripe.Invoice,
  discountLabel: string | null,
  planSlug: StripePaidPlanId,
): Promise<{
  promoCode: string | null;
  promoKind: AdminInvoicePromoKind | null;
  percentOff: number | null;
}> {
  const percentFromCoupon = invoiceCouponPercentOff(invoice);
  const parsedFromLabel = parsePromoFromDiscountLabel(discountLabel);

  const raw = invoice as unknown as Record<string, unknown>;
  const subscriptionRef = raw.subscription;
  const subscriptionId =
    typeof subscriptionRef === "string"
      ? subscriptionRef
      : typeof subscriptionRef === "object" &&
          subscriptionRef !== null &&
          typeof (subscriptionRef as { id?: string }).id === "string"
        ? (subscriptionRef as { id: string }).id
        : null;

  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const promoCode = stringOrNull(sub.metadata?.promoCode);
      const promoKind = normalizeAdminInvoicePromoKind(
        stringOrNull(sub.metadata?.promoKind),
      );
      if (promoCode && promoKind) {
        const percentOff =
          percentFromCoupon ??
          (await resolvePromoPercentFromPlanConfig({
            promoCode,
            promoKind,
            planSlug,
          }));
        return { promoCode, promoKind, percentOff };
      }
    } catch (error) {
      console.error("[resolveInvoicePromoFromStripe]", subscriptionId, error);
    }
  }

  if (parsedFromLabel.promoCode && parsedFromLabel.promoKind) {
    const percentOff =
      percentFromCoupon ??
      (await resolvePromoPercentFromPlanConfig({
        promoCode: parsedFromLabel.promoCode,
        promoKind: parsedFromLabel.promoKind,
        planSlug,
      }));
    return {
      promoCode: parsedFromLabel.promoCode,
      promoKind: parsedFromLabel.promoKind,
      percentOff,
    };
  }

  return {
    promoCode: parsedFromLabel.promoCode,
    promoKind: parsedFromLabel.promoKind,
    percentOff: percentFromCoupon,
  };
}

async function retrieveInvoiceForPersist(
  invoiceRef: string | Stripe.Invoice,
): Promise<Stripe.Invoice> {
  const invoiceId = typeof invoiceRef === "string" ? invoiceRef : invoiceRef.id;
  return stripe.invoices.retrieve(invoiceId, {
    expand: [
      "lines.data",
      "subscription",
      "total_discount_amounts.discount",
      "total_discount_amounts.discount.coupon",
      "total_discount_amounts.discount.promotion_code",
      "discounts",
      "discounts.coupon",
      "discounts.promotion_code",
      "payment_intent.latest_charge",
    ],
  });
}

async function persistInvoiceRefForUser(
  userId: string,
  userEmail: string | null,
  invoiceRef: string | Stripe.Invoice | null | undefined,
): Promise<void> {
  if (!invoiceRef) return;
  try {
    const invoice = await retrieveInvoiceForPersist(invoiceRef);
    await persistStripeInvoiceForUser(userId, userEmail, invoice);
  } catch (error) {
    console.error("[persistInvoiceRefForUser]", invoiceRef, error);
  }
}

/**
 * After Elements / hosted Checkout redirect — persists the paid invoice when webhooks
 * did not reach the app (common in local dev without `stripe listen`).
 */
export async function syncCheckoutSessionInvoicesForUser(
  userId: string,
  checkoutSessionId: string,
): Promise<void> {
  const sessionId = checkoutSessionId.trim();
  if (!isStripeCheckoutSessionId(sessionId)) return;

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["invoice", "subscription", "payment_intent.latest_charge"],
  });

  if (session.metadata?.clerkUserId?.trim() !== userId) return;

  const email = await resolveUserEmail(userId);
  const selectedPlan = asPaidPlanId(session.metadata?.plan);

  const subscriptionRef = session.subscription;
  const subscriptionId =
    typeof subscriptionRef === "string"
      ? subscriptionRef
      : subscriptionRef && typeof subscriptionRef === "object"
        ? subscriptionRef.id
        : null;

  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["latest_invoice.payment_intent.latest_charge"],
      });
      if (selectedPlan) {
        await upsertStripeSubscriptionFromStripeSub(userId, sub, selectedPlan);
      }
      await persistInvoiceRefForUser(userId, email, sub.latest_invoice);
    } catch (error) {
      console.error(
        "[syncCheckoutSessionInvoicesForUser] subscription",
        subscriptionId,
        error,
      );
    }
  }

  await persistInvoiceRefForUser(userId, email, session.invoice);

  const chargeReceipt = await resolveCheckoutSessionChargeReceiptUrl(session);
  if (chargeReceipt && session.invoice) {
    const invoiceId =
      typeof session.invoice === "string" ? session.invoice : session.invoice.id;
    try {
      const existing = await stripe.invoices.retrieve(invoiceId);
      if (!existing.hosted_invoice_url && !existing.invoice_pdf) {
        await upsertBillingInvoiceRecord({
          externalId: invoiceId,
          source: "invoice",
          userId,
          userEmail: email,
          planSlug: selectedPlan,
          status: existing.status ?? "paid",
          hostedInvoiceUrl: chargeReceipt,
        });
      }
    } catch (error) {
      console.error(
        "[syncCheckoutSessionInvoicesForUser] charge receipt patch",
        invoiceId,
        error,
      );
    }
  }
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

  const rawDiscountLabel = invoiceDiscountLabel(invoice);
  const { promoCode, promoKind, percentOff } = await resolveInvoicePromoFromStripe(
    invoice,
    rawDiscountLabel,
    invoicePlan,
  );
  const discountLabel = normalizeBillingInvoiceDiscountLabel({
    promoCode,
    promoKind,
    discountLabel: rawDiscountLabel,
    percentOff,
  });

  if (promoCode && promoKind && percentOff) {
    const couponId = invoiceCouponId(invoice);
    if (couponId) {
      try {
        await stampStripeCouponInvoiceLabel({
          couponId,
          customerPromoCode: promoCode,
          kind: promoKind,
          percentOff,
        });
      } catch (error) {
        console.error("[persistStripeInvoiceForUser] stamp coupon label", couponId, error);
      }
    }
  }

  const receiptUrls = await resolveStripeInvoiceReceiptUrls(invoice);

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
    hostedInvoiceUrl: receiptUrls.hostedInvoiceUrl,
    invoicePdfUrl: receiptUrls.invoicePdfUrl,
    periodStart: invoicePeriodStart,
    periodEnd: invoicePeriodEnd,
    paidAt:
      typeof invoice.status_transitions?.paid_at === "number"
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : null,
    discountAmountCents: invoiceDiscountCents(invoice),
    discountLabel,
    promoCode,
    promoKind,
    stripeBillingReason: stringOrNull(invoice.billing_reason),  });

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
      await persistInvoiceRefForUser(userId, email, invoice.id);
    } catch (error) {
      console.error("[syncRecentStripeInvoicesForUser]", invoice.id, error);
    }
  }
}

/**
 * Pulls the subscription's latest invoice plus recent history — covers plan changes
 * and re-subscribes when webhooks lag (local dev).
 */
export async function syncBillingInvoicesForUser(userId: string): Promise<void> {
  const subRow =
    (await getActiveStripeSubscription(userId)) ??
    (await getManageableStripeSubscription(userId));

  const email = await resolveUserEmail(userId);

  if (subRow?.stripeSubscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subRow.stripeSubscriptionId, {
        expand: ["latest_invoice.payment_intent.latest_charge"],
      });
      const latest = sub.latest_invoice;
      if (latest) {
        await persistInvoiceRefForUser(userId, email, latest);
      }
    } catch (error) {
      console.error("[syncBillingInvoicesForUser] latest_invoice:", error);
    }
  }

  await syncRecentStripeInvoicesForUser(userId, {
    customerId: subRow?.stripeCustomerId,
    limit: 36,
  });
}

/** Re-sync from Stripe and return the newest paid invoice row for plan history / receipts. */
export async function refreshLatestPaidInvoiceForUser(
  userId: string,
  planSlug?: string | null,
): Promise<Awaited<ReturnType<typeof listBillingInvoicesForUser>>[number] | null> {
  await syncBillingInvoicesForUser(userId);
  const email = await resolveUserEmail(userId);
  const invoices = await listBillingInvoicesForUser(userId, email);
  const paid = invoices
    .filter((inv) => inv.status?.toLowerCase() === "paid")
    .sort((a, b) => {
      const aMs = a.paidAt?.getTime() ?? a.createdAt.getTime();
      const bMs = b.paidAt?.getTime() ?? b.createdAt.getTime();
      return bMs - aMs;
    });
  const slug = planSlug?.trim().toLowerCase();
  if (slug) {
    const forPlan = paid.find((inv) => inv.planSlug?.trim().toLowerCase() === slug);
    if (forPlan) return forPlan;
  }
  return paid[0] ?? null;
}

async function promoDisplayFromStripeInvoice(
  invoice: Stripe.Invoice,
): Promise<string | null> {
  const invoicePlan = await resolvePlanSlugForInvoice(invoice);
  const rawDiscountLabel = invoiceDiscountLabel(invoice);
  const { promoCode, promoKind, percentOff } = await resolveInvoicePromoFromStripe(
    invoice,
    rawDiscountLabel,
    invoicePlan,
  );
  const discountLabel = normalizeBillingInvoiceDiscountLabel({
    promoCode,
    promoKind,
    discountLabel: rawDiscountLabel,
    percentOff,
  });
  return formatUserInvoicePromoDisplay({
    promoCode,
    promoKind,
    discountLabel,
    percentOff,
  });
}

/** Promo label from a Stripe invoice (general or affiliate), matching hosted receipt text. */
export async function resolvePromoDisplayForStripeInvoiceId(
  invoiceId: string,
): Promise<string | null> {
  const id = invoiceId.trim();
  if (!id.startsWith("in_")) return null;
  try {
    const invoice = await retrieveInvoiceForPersist(id);
    return promoDisplayFromStripeInvoice(invoice);
  } catch (error) {
    console.error("[resolvePromoDisplayForStripeInvoiceId]", id, error);
    return null;
  }
}

/** Re-fetch invoice from Stripe, persist promo fields, return display label for plan history. */
export async function backfillInvoicePromoForUser(
  userId: string,
  userEmail: string | null,
  invoiceId: string,
): Promise<string | null> {
  const id = invoiceId.trim();
  if (!id.startsWith("in_")) return null;
  try {
    await persistInvoiceRefForUser(userId, userEmail, id);
    return resolvePromoDisplayForStripeInvoiceId(id);
  } catch (error) {
    console.error("[backfillInvoicePromoForUser]", id, error);
    return null;
  }
}
