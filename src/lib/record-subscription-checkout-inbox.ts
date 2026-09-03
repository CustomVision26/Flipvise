import type Stripe from "stripe";
import { getAddonCatalogByKey } from "@/db/queries/addons";
import { upsertSubscriptionCheckoutConfirmation } from "@/db/queries/subscription-checkout-inbox";
import {
  formatUserInvoicePromoDisplay,
  normalizeAdminInvoicePromoKind,
} from "@/lib/admin-invoice-promo-display";
import { asPaidPlanId } from "@/lib/stripe-billing-sync";
import { stripe } from "@/lib/stripe";
import {
  isStripeCheckoutSessionId,
  isStripeSetupIntentId,
} from "@/lib/stripe-checkout-session-id";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import { resolveCheckoutSessionChargeReceiptUrl } from "@/lib/stripe-invoice-receipt-url";
import { notifyNativeInboxPush } from "@/lib/notify-native-inbox-push";
import { STRIPE_ADDON_META_TYPE } from "@/lib/stripe-addon-metadata";
import { normalizeCheckoutPeriod } from "@/lib/subscription-checkout-inbox-copy";

export {
  resolveSubscriptionCheckoutConfirmationKind,
  subscriptionCheckoutConfirmationDescription,
  subscriptionCheckoutConfirmationTitle,
} from "@/lib/subscription-checkout-inbox-copy";
export type {
  SubscriptionCheckoutConfirmationKind,
  SubscriptionCheckoutTrialDates,
} from "@/lib/subscription-checkout-inbox-copy";

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
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

  const isAddon = session.metadata?.type === STRIPE_ADDON_META_TYPE;
  const period = normalizeCheckoutPeriod(session.metadata?.period);
  const amountCents =
    typeof session.amount_total === "number" ? session.amount_total : null;
  const currency = stringOrNull(session.currency)?.toUpperCase() ?? null;
  const receiptUrl = await resolveReceiptUrl(session, options?.receiptUrl);

  let planSlug: string;
  let planLabel: string;
  let promoDisplay: string | null = null;

  if (isAddon) {
    const addonKey = stringOrNull(session.metadata?.addonKey) ?? "add-on";
    const catalog = await getAddonCatalogByKey(addonKey);
    planSlug = `addon:${addonKey}`.slice(0, 128);
    planLabel = (catalog?.name ?? "Add-on").slice(0, 128);
  } else {
    const paid = asPaidPlanId(session.metadata?.plan) ?? "pro";
    planSlug = paid;
    planLabel = displayNameForBillingPlanSlug(paid);
    const promoKind = normalizeAdminInvoicePromoKind(session.metadata?.promoKind);
    const promoCode = stringOrNull(session.metadata?.promoCode);
    promoDisplay =
      promoCode && promoKind
        ? formatUserInvoicePromoDisplay({ promoCode, promoKind })
        : null;
  }

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
    body: isAddon
      ? `${planLabel} add-on confirmed`
      : `${planLabel} subscription confirmed`,
  });
}

/** Inbox confirmation after a prorated base-plan change (SetupIntent flow). */
export async function recordPlanChangeCheckoutInboxConfirmation(input: {
  userId: string;
  setupIntentId: string;
  planSlug: string;
  planLabel: string;
  period: "monthly" | "yearly";
  amountCents?: number | null;
  currency?: string | null;
  receiptUrl?: string | null;
}): Promise<void> {
  const setupIntentId = input.setupIntentId.trim();
  if (!isStripeSetupIntentId(setupIntentId)) return;

  await upsertSubscriptionCheckoutConfirmation({
    userId: input.userId,
    checkoutSessionId: setupIntentId,
    planSlug: input.planSlug.slice(0, 128),
    planLabel: input.planLabel.slice(0, 128),
    period: input.period,
    amountCents: input.amountCents ?? null,
    currency: input.currency?.toUpperCase() ?? null,
    promoDisplay: "Prorated plan change",
    receiptUrl: input.receiptUrl?.trim() || null,
  });

  notifyNativeInboxPush({
    recipientUserId: input.userId,
    category: "subscription_checkout",
    body: `${input.planLabel} plan updated`,
  });
}
