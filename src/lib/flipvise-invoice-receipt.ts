import type Stripe from "stripe";
import { getBillingInvoiceByRef } from "@/db/queries/billing";
import { getPlatformContactSettings } from "@/db/queries/contact-us";
import { getUserPlanTrial } from "@/db/queries/user-plan-trials";
import {
  formatPlatformCompanyAddressInvoiceLines,
  parsePlatformCompanyAddress,
} from "@/lib/platform-company-address";
import { formatStripeInvoiceLineDescription } from "@/lib/stripe-invoice-trial-line";
import { stripe } from "@/lib/stripe";

export type FlipviseInvoiceReceiptLine = {
  description: string;
  quantity: number | null;
  amountLabel: string;
};

export type FlipviseInvoiceReceipt = {
  externalId: string;
  title: "Receipt" | "Invoice";
  invoiceNumber: string | null;
  receiptNumber: string | null;
  datePaidLabel: string | null;
  planPeriodStartLabel: string | null;
  planPeriodEndLabel: string | null;
  autoRenewalOn: boolean | null;
  sellerLines: string[];
  billToName: string | null;
  billToLines: string[];
  billToEmail: string | null;
  amountPaidLabel: string;
  amountPaidCents: number;
  currency: string;
  lines: FlipviseInvoiceReceiptLine[];
  stripeHostedUrl: string | null;
  paid: boolean;
};

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatPaidDate(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  return formatDateFromMs(seconds * 1000);
}

function formatDateFromMs(ms: number | null | undefined): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateValue(value: Date | number | null | undefined): string | null {
  if (value instanceof Date) return formatDateFromMs(value.getTime());
  if (typeof value === "number") {
    return value > 1_000_000_000_000 ? formatDateFromMs(value) : formatPaidDate(value);
  }
  return null;
}

function stripeAddressLines(
  address:
    | Stripe.Address
    | {
        line1?: string | null;
        line2?: string | null;
        city?: string | null;
        state?: string | null;
        postal_code?: string | null;
        country?: string | null;
      }
    | null
    | undefined,
): string[] {
  if (!address) return [];
  const cityState = [address.city, address.state].filter(Boolean).join(", ");
  const cityLine = [cityState, address.postal_code].filter(Boolean).join(" ");
  return [
    address.line1?.trim() ?? "",
    address.line2?.trim() ?? "",
    cityLine.trim(),
    address.country?.trim() ?? "",
  ].filter(Boolean);
}

async function loadStripeInvoiceLines(
  invoiceId: string,
  initial: Stripe.InvoiceLineItem[] | undefined,
  hasMore: boolean | undefined,
): Promise<Stripe.InvoiceLineItem[]> {
  if (!hasMore && initial?.length) return initial;
  const listed = await stripe.invoices.listLineItems(invoiceId, { limit: 100 });
  return listed.data;
}

function unixSecondsOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function invoiceLinePeriodBounds(lines: Stripe.InvoiceLineItem[]): {
  start: number | null;
  end: number | null;
} {
  let start: number | null = null;
  let end: number | null = null;
  for (const line of lines) {
    const lineStart = unixSecondsOrNull(line.period?.start);
    const lineEnd = unixSecondsOrNull(line.period?.end);
    if (lineStart != null) start = start == null ? lineStart : Math.min(start, lineStart);
    if (lineEnd != null) end = end == null ? lineEnd : Math.max(end, lineEnd);
  }
  return { start, end };
}

function subscriptionCurrentPeriod(subscription: Stripe.Subscription): {
  start: number | null;
  end: number | null;
} {
  const item = subscription.items.data[0] as
    | (Stripe.SubscriptionItem & {
        current_period_start?: number;
        current_period_end?: number;
      })
    | undefined;
  const sub = subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };
  return {
    start:
      unixSecondsOrNull(item?.current_period_start) ??
      unixSecondsOrNull(sub.current_period_start),
    end:
      unixSecondsOrNull(item?.current_period_end) ??
      unixSecondsOrNull(sub.current_period_end),
  };
}

function autoRenewalFromSubscription(subscription: Stripe.Subscription): boolean {
  if (subscription.cancel_at_period_end === true) return false;
  if (
    subscription.status === "canceled" ||
    subscription.status === "unpaid" ||
    subscription.status === "incomplete_expired"
  ) {
    return false;
  }
  return (
    subscription.status === "active" ||
    subscription.status === "trialing" ||
    subscription.status === "past_due"
  );
}

type InvoiceSubscriptionContext = {
  trialStart: number | null;
  trialEnd: number | null;
  periodStart: number | null;
  periodEnd: number | null;
  autoRenewalOn: boolean | null;
};

async function loadInvoiceSubscriptionContext(input: {
  invoice: Stripe.Invoice;
  lineItems: Stripe.InvoiceLineItem[];
  userId: string;
  storedPeriodStart: Date | null;
  storedPeriodEnd: Date | null;
}): Promise<InvoiceSubscriptionContext> {
  const linePeriod = invoiceLinePeriodBounds(input.lineItems);
  let trialStart: number | null = null;
  let trialEnd: number | null = null;
  let periodStart = linePeriod.start;
  let periodEnd = linePeriod.end;
  let autoRenewalOn: boolean | null = null;

  const subRef = input.invoice.parent?.subscription_details?.subscription;
  const subId =
    typeof subRef === "string"
      ? subRef
      : subRef && typeof subRef === "object" && "id" in subRef
        ? String(subRef.id)
        : null;

  if (subId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subId, {
        expand: ["items.data"],
      });
      trialStart = unixSecondsOrNull(subscription.trial_start);
      trialEnd = unixSecondsOrNull(subscription.trial_end);
      autoRenewalOn = autoRenewalFromSubscription(subscription);
      const current = subscriptionCurrentPeriod(subscription);
      periodStart = periodStart ?? current.start;
      periodEnd = periodEnd ?? current.end;
    } catch (error) {
      console.error("[loadFlipviseInvoiceReceipt] subscription", subId, error);
    }
  }

  if (trialStart == null && trialEnd == null) {
    try {
      const trial = await getUserPlanTrial(input.userId);
      if (trial?.trialEndsAt) {
        trialEnd = Math.floor(trial.trialEndsAt.getTime() / 1000);
      }
    } catch (error) {
      console.error("[loadFlipviseInvoiceReceipt] userPlanTrial", error);
    }
  }

  if (periodStart == null && input.storedPeriodStart) {
    periodStart = Math.floor(input.storedPeriodStart.getTime() / 1000);
  }
  if (periodEnd == null && input.storedPeriodEnd) {
    periodEnd = Math.floor(input.storedPeriodEnd.getTime() / 1000);
  }

  return { trialStart, trialEnd, periodStart, periodEnd, autoRenewalOn };
}

export async function loadFlipviseInvoiceReceipt(input: {
  ref: string;
  userId: string;
  userEmail?: string | null;
  isAdmin: boolean;
}): Promise<FlipviseInvoiceReceipt | null> {
  const row = await getBillingInvoiceByRef(input.ref);
  if (!row) return null;

  const email = input.userEmail?.trim().toLowerCase() ?? "";
  const owns =
    row.userId === input.userId ||
    (email.length > 0 && (row.userEmail ?? "").toLowerCase() === email);
  if (!owns && !input.isAdmin) return null;

  const settings = await getPlatformContactSettings();
  const sellerLines = formatPlatformCompanyAddressInvoiceLines(
    parsePlatformCompanyAddress(settings.companyAddress),
    settings.phone,
  );

  const currency = (row.currency ?? "usd").toLowerCase();
  const amountPaidCents = row.amountCents ?? 0;
  const fallbackPaid =
    (row.status ?? "").toLowerCase() === "paid" && row.paidAt
      ? row.paidAt.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

  const fallback: FlipviseInvoiceReceipt = {
    externalId: row.externalId,
    title: (row.status ?? "").toLowerCase() === "paid" ? "Receipt" : "Invoice",
    invoiceNumber: row.invoiceNumber,
    receiptNumber: null,
    datePaidLabel: fallbackPaid,
    planPeriodStartLabel: formatDateValue(row.periodStart),
    planPeriodEndLabel: formatDateValue(row.periodEnd),
    autoRenewalOn: null,
    sellerLines,
    billToName: null,
    billToLines: [],
    billToEmail: row.userEmail,
    amountPaidLabel: formatMoney(amountPaidCents, currency),
    amountPaidCents,
    currency,
    lines: [],
    stripeHostedUrl: row.hostedInvoiceUrl,
    paid: (row.status ?? "").toLowerCase() === "paid",
  };

  if (!row.externalId.startsWith("in_")) return fallback;

  try {
    const invoice = await stripe.invoices.retrieve(row.externalId);
    const lineItems = await loadStripeInvoiceLines(
      invoice.id,
      invoice.lines?.data,
      invoice.lines?.has_more,
    );
    const paidAt = invoice.status_transitions?.paid_at ?? null;
    const datePaidLabel = formatPaidDate(paidAt);
    const paid = invoice.status === "paid";
    const cents =
      typeof invoice.amount_paid === "number"
        ? invoice.amount_paid
        : typeof invoice.amount_due === "number"
          ? invoice.amount_due
          : amountPaidCents;
    const invCurrency = (invoice.currency ?? currency).toLowerCase();
    const customerAddress =
      invoice.customer_address ?? invoice.customer_shipping?.address ?? null;
    const subscriptionContext = await loadInvoiceSubscriptionContext({
      invoice,
      lineItems,
      userId: input.userId,
      storedPeriodStart: row.periodStart,
      storedPeriodEnd: row.periodEnd,
    });
    const trialWindow = {
      start: subscriptionContext.trialStart,
      end: subscriptionContext.trialEnd,
    };

    return {
      externalId: row.externalId,
      title: paid ? "Receipt" : "Invoice",
      invoiceNumber: stringOrNull(invoice.number) ?? row.invoiceNumber,
      receiptNumber: stringOrNull(invoice.receipt_number),
      datePaidLabel,
      planPeriodStartLabel: formatPaidDate(subscriptionContext.periodStart),
      planPeriodEndLabel: formatPaidDate(subscriptionContext.periodEnd),
      autoRenewalOn: subscriptionContext.autoRenewalOn,
      sellerLines,
      billToName: stringOrNull(invoice.customer_name),
      billToLines: stripeAddressLines(customerAddress),
      billToEmail: stringOrNull(invoice.customer_email) ?? row.userEmail,
      amountPaidLabel: formatMoney(cents, invCurrency),
      amountPaidCents: cents,
      currency: invCurrency,
      lines: lineItems.map((line) => {
        const isTrialCopy = /free trial/i.test(line.description ?? "");
        const hasTrialEnd = trialWindow.end != null;
        return {
          description: formatStripeInvoiceLineDescription({
            description: stringOrNull(line.description),
            amountCents: line.amount ?? 0,
            trialStartSeconds:
              trialWindow.start ??
              (hasTrialEnd ? unixSecondsOrNull(invoice.created) : null) ??
              (isTrialCopy ? unixSecondsOrNull(line.period?.start) : null),
            trialEndSeconds:
              trialWindow.end ??
              (isTrialCopy ? unixSecondsOrNull(line.period?.end) : null),
          }),
          quantity: typeof line.quantity === "number" ? line.quantity : null,
          amountLabel: formatMoney(line.amount ?? 0, invCurrency),
        };
      }),
      stripeHostedUrl:
        stringOrNull(invoice.hosted_invoice_url) ?? row.hostedInvoiceUrl,
      paid,
    };
  } catch (error) {
    console.error("[loadFlipviseInvoiceReceipt]", row.externalId, error);
    return fallback;
  }
}
