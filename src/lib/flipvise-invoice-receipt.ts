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
  return new Date(seconds * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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

async function loadInvoiceTrialWindow(input: {
  invoice: Stripe.Invoice;
  userId: string;
}): Promise<{ start: number | null; end: number | null }> {
  const subRef = input.invoice.parent?.subscription_details?.subscription;
  const subId =
    typeof subRef === "string"
      ? subRef
      : subRef && typeof subRef === "object" && "id" in subRef
        ? String(subRef.id)
        : null;

  if (subId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subId);
      const start = unixSecondsOrNull(subscription.trial_start);
      const end = unixSecondsOrNull(subscription.trial_end);
      if (start != null || end != null) return { start, end };
    } catch (error) {
      console.error("[loadFlipviseInvoiceReceipt] subscription", subId, error);
    }
  }

  try {
    const trial = await getUserPlanTrial(input.userId);
    if (trial?.trialEndsAt) {
      return {
        start: null,
        end: Math.floor(trial.trialEndsAt.getTime() / 1000),
      };
    }
  } catch (error) {
    console.error("[loadFlipviseInvoiceReceipt] userPlanTrial", error);
  }

  return { start: null, end: null };
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
    const trialWindow = await loadInvoiceTrialWindow({
      invoice,
      userId: input.userId,
    });

    return {
      externalId: row.externalId,
      title: paid ? "Receipt" : "Invoice",
      invoiceNumber: stringOrNull(invoice.number) ?? row.invoiceNumber,
      receiptNumber: stringOrNull(invoice.receipt_number),
      datePaidLabel,
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
