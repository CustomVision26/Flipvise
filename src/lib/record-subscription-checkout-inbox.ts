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

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizePeriod(value: unknown): "monthly" | "yearly" {
  return value === "yearly" ? "yearly" : "monthly";
}

function periodLabel(period: "monthly" | "yearly"): string {
  return period === "yearly" ? "annual" : "monthly";
}

function formatMoney(
  amountCents: number | null,
  currency: string | null,
): string | null {
  if (amountCents == null) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency ?? "USD").toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency ?? "USD"}`;
  }
}

export type SubscriptionCheckoutConfirmationKind =
  | "plan"
  | "addon"
  | "plan_change";

export function resolveSubscriptionCheckoutConfirmationKind(input: {
  planSlug: string;
  checkoutSessionId: string;
  promoDisplay?: string | null;
}): SubscriptionCheckoutConfirmationKind {
  if (input.planSlug.startsWith("addon:")) return "addon";
  if (
    isStripeSetupIntentId(input.checkoutSessionId) ||
    input.promoDisplay === "Prorated plan change"
  ) {
    return "plan_change";
  }
  return "plan";
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
  const period = normalizePeriod(session.metadata?.period);
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

export function subscriptionCheckoutConfirmationTitle(input: {
  planLabel: string;
  planSlug: string;
  checkoutSessionId: string;
  promoDisplay?: string | null;
}): string {
  const kind = resolveSubscriptionCheckoutConfirmationKind(input);
  if (kind === "addon") return `Add-on confirmed — ${input.planLabel}`;
  if (kind === "plan_change") return `Plan updated — ${input.planLabel}`;
  return `Subscription confirmed — ${input.planLabel}`;
}

/** Formal inbox body for plan / add-on / plan-change confirmations. */
export function subscriptionCheckoutConfirmationDescription(input: {
  planLabel: string;
  planSlug: string;
  checkoutSessionId: string;
  period: string;
  amountCents: number | null;
  currency: string | null;
  promoDisplay: string | null;
}): string {
  const kind = resolveSubscriptionCheckoutConfirmationKind(input);
  const period = normalizePeriod(input.period);
  const billing = periodLabel(period);
  const amount = formatMoney(input.amountCents, input.currency);
  const amountClause = amount
    ? ` Today's charge was ${amount} (${billing} billing).`
    : ` Billing is ${billing}.`;
  const promoClause = input.promoDisplay
    ? ` Promotion applied: ${input.promoDisplay}.`
    : "";

  if (kind === "addon") {
    return (
      `Thank you for unlocking the ${input.planLabel} add-on on your Flipvise account.` +
      amountClause +
      ` This add-on is active now and renews separately from your base plan; you may cancel the add-on anytime in Billing without ending your plan.` +
      ` A copy of this confirmation is kept in your inbox for your records.`
    );
  }

  if (kind === "plan_change") {
    return (
      `Thank you for confirming your plan change to ${input.planLabel}.` +
      amountClause +
      promoClause +
      ` Your subscription has been updated with proration for the remainder of the current billing period.` +
      ` You can review receipts and manage renewal in Billing. This confirmation is saved in your inbox.`
    );
  }

  return (
    `Thank you for subscribing to the ${input.planLabel} plan on Flipvise.` +
    amountClause +
    promoClause +
    ` Your subscription is active, and paid features for this plan are available on your personal dashboard.` +
    ` You can manage billing, receipts, and cancellation from your profile → Billing. This confirmation is saved in your inbox.`
  );
}
