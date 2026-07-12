import type Stripe from "stripe";
import { upsertSubscriptionCheckoutConfirmation } from "@/db/queries/subscription-checkout-inbox";
import {
  formatUserInvoicePromoDisplay,
  normalizeAdminInvoicePromoKind,
} from "@/lib/admin-invoice-promo-display";
import { asPaidPlanId } from "@/lib/stripe-billing-sync";
import { stripe } from "@/lib/stripe";
import { isStripeCheckoutSessionId } from "@/lib/stripe-checkout-session-id";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import { resolveCheckoutSessionChargeReceiptUrl } from "@/lib/stripe-invoice-receipt-url";
import { notifyNativeInboxPush } from "@/lib/notify-native-inbox-push";

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizePeriod(value: unknown): "monthly" | "yearly" {
  return value === "yearly" ? "yearly" : "monthly";
}

function periodLabel(period: "monthly" | "yearly"): string {
  return period === "yearly" ? "Annual" : "Monthly";
}

async function resolveReceiptUrl(
  session: Stripe.Checkout.Session,
  receiptUrlHint?: string | null,
): Promise<string | null> {
  const hinted = receiptUrlHint?.trim();
  if (hinted) return hinted;
  return resolveCheckoutSessionChargeReceiptUrl(session);
}

export async function recordSubscriptionCheckoutInboxForSession(
  userId: string,
  checkoutSessionId: string,
  options?: { receiptUrl?: string | null },
): Promise<void> {
  const sessionId = checkoutSessionId.trim();
  if (!isStripeCheckoutSessionId(sessionId)) return;

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent.latest_charge"],
  });

  if (session.metadata?.clerkUserId?.trim() !== userId) return;
  if (session.mode !== "subscription") return;

  const planSlug = asPaidPlanId(session.metadata?.plan) ?? "pro";
  const planLabel = displayNameForBillingPlanSlug(planSlug);
  const period = normalizePeriod(session.metadata?.period);
  const promoKind = normalizeAdminInvoicePromoKind(session.metadata?.promoKind);
  const promoCode = stringOrNull(session.metadata?.promoCode);
  const promoDisplay =
    promoCode && promoKind
      ? formatUserInvoicePromoDisplay({ promoCode, promoKind })
      : null;

  const amountCents =
    typeof session.amount_total === "number" ? session.amount_total : null;
  const currency = stringOrNull(session.currency)?.toUpperCase() ?? null;
  const receiptUrl = await resolveReceiptUrl(session, options?.receiptUrl);

  await upsertSubscriptionCheckoutConfirmation({
    userId,
    checkoutSessionId: sessionId,
    planSlug,
    planLabel,
    period,
    amountCents,
    currency,
    promoDisplay,
    receiptUrl,
  });

  notifyNativeInboxPush({
    recipientUserId: userId,
    category: "subscription_checkout",
    body: `${planLabel} subscription confirmed`,
  });
}

export function subscriptionCheckoutConfirmationDescription(input: {
  period: string;
  amountCents: number | null;
  currency: string | null;
  promoDisplay: string | null;
}): string {
  const period = normalizePeriod(input.period);
  const parts: string[] = [periodLabel(period)];

  if (input.amountCents != null) {
    try {
      parts.push(
        new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: (input.currency ?? "USD").toUpperCase(),
          maximumFractionDigits: 2,
        }).format(input.amountCents / 100),
      );
    } catch {
      parts.push(`${(input.amountCents / 100).toFixed(2)} ${input.currency ?? "USD"}`);
    }
  }

  if (input.promoDisplay) parts.push(input.promoDisplay);

  return parts.join(" · ");
}
