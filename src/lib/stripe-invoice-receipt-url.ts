import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function chargeReceiptUrlFromPaymentIntentId(
  paymentIntentId: string,
): Promise<string | null> {
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
    const charge = pi.latest_charge;
    if (charge && typeof charge === "object") {
      return stringOrNull((charge as Stripe.Charge).receipt_url);
    }
  } catch (error) {
    console.error("[chargeReceiptUrlFromPaymentIntentId]", paymentIntentId, error);
  }
  return null;
}

async function chargeReceiptUrlFromChargeId(chargeId: string): Promise<string | null> {
  try {
    const charge = await stripe.charges.retrieve(chargeId);
    return stringOrNull(charge.receipt_url);
  } catch (error) {
    console.error("[chargeReceiptUrlFromChargeId]", chargeId, error);
  }
  return null;
}

/** Hosted invoice, PDF, or card charge receipt — whichever Stripe exposes. */
export async function resolveStripeInvoiceReceiptUrls(
  invoice: Stripe.Invoice,
): Promise<{ hostedInvoiceUrl: string | null; invoicePdfUrl: string | null }> {
  const hosted = stringOrNull(invoice.hosted_invoice_url);
  const pdf = stringOrNull(invoice.invoice_pdf);
  if (hosted || pdf) {
    return { hostedInvoiceUrl: hosted, invoicePdfUrl: pdf };
  }

  const raw = invoice as unknown as Record<string, unknown>;
  const piRef = raw.payment_intent;
  const piId =
    typeof piRef === "string"
      ? piRef
      : piRef && typeof piRef === "object"
        ? stringOrNull((piRef as { id?: string }).id)
        : null;

  if (piId) {
    const embeddedCharge =
      piRef &&
      typeof piRef === "object" &&
      (piRef as { latest_charge?: Stripe.Charge | string }).latest_charge;
    if (embeddedCharge && typeof embeddedCharge === "object") {
      const url = stringOrNull((embeddedCharge as Stripe.Charge).receipt_url);
      if (url) return { hostedInvoiceUrl: url, invoicePdfUrl: null };
    }
    const fromPi = await chargeReceiptUrlFromPaymentIntentId(piId);
    if (fromPi) return { hostedInvoiceUrl: fromPi, invoicePdfUrl: null };
  }

  const chargeRef = raw.charge;
  const chargeId =
    typeof chargeRef === "string"
      ? chargeRef
      : chargeRef && typeof chargeRef === "object"
        ? stringOrNull((chargeRef as { id?: string }).id)
        : null;

  if (chargeId) {
    const fromCharge = await chargeReceiptUrlFromChargeId(chargeId);
    if (fromCharge) return { hostedInvoiceUrl: fromCharge, invoicePdfUrl: null };
  }

  return { hostedInvoiceUrl: null, invoicePdfUrl: null };
}

export async function resolveCheckoutSessionChargeReceiptUrl(
  session: Stripe.Checkout.Session,
): Promise<string | null> {
  const piRef = session.payment_intent;
  const piId =
    typeof piRef === "string"
      ? piRef
      : piRef && typeof piRef === "object"
        ? stringOrNull(piRef.id)
        : null;

  if (!piId) return null;

  if (piRef && typeof piRef === "object" && piRef.latest_charge) {
    const charge = piRef.latest_charge;
    if (typeof charge === "object") {
      const url = stringOrNull((charge as Stripe.Charge).receipt_url);
      if (url) return url;
    }
  }

  return chargeReceiptUrlFromPaymentIntentId(piId);
}
