import { isStripeSetupIntentId } from "@/lib/stripe-checkout-session-id";
import { withFlipviseInboxSignature } from "@/lib/flipvise-inbox-signature";

export type SubscriptionCheckoutConfirmationKind =
  | "plan"
  | "addon"
  | "plan_change";

export type SubscriptionCheckoutTrialDates = {
  startedAt: Date;
  endsAt: Date;
  chargeAt: Date;
};

export function normalizeCheckoutPeriod(value: unknown): "monthly" | "yearly" {
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

function formatInboxDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

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

export function subscriptionCheckoutConfirmationTitle(input: {
  planLabel: string;
  planSlug: string;
  checkoutSessionId: string;
  promoDisplay?: string | null;
  trial?: SubscriptionCheckoutTrialDates | null;
}): string {
  const kind = resolveSubscriptionCheckoutConfirmationKind(input);
  if (kind === "addon") return `Add-on confirmed — ${input.planLabel}`;
  if (kind === "plan_change") return `Plan updated — ${input.planLabel}`;
  if (input.trial) return `Subscription confirmed — ${input.planLabel} (free trial)`;
  return `Subscription confirmed — ${input.planLabel}`;
}

function trialInboxClause(
  trial: SubscriptionCheckoutTrialDates | null | undefined,
  billing: string,
): string {
  if (!trial) return "";
  return (
    ` You are on a free trial that started ${formatInboxDate(trial.startedAt)}` +
    ` and ends ${formatInboxDate(trial.endsAt)}.` +
    ` Your first ${billing} renewal charge will be billed on ${formatInboxDate(trial.chargeAt)}.`
  );
}

export function subscriptionCheckoutConfirmationDescription(input: {
  planLabel: string;
  planSlug: string;
  checkoutSessionId: string;
  period: string;
  amountCents: number | null;
  currency: string | null;
  promoDisplay: string | null;
  trial?: SubscriptionCheckoutTrialDates | null;
}): string {
  const kind = resolveSubscriptionCheckoutConfirmationKind(input);
  const period = normalizeCheckoutPeriod(input.period);
  const billing = periodLabel(period);
  const amount = formatMoney(input.amountCents, input.currency);
  const amountClause = amount
    ? ` Today's charge was ${amount} (${billing} billing).`
    : ` Billing is ${billing}.`;
  const promoClause = input.promoDisplay
    ? ` Promotion applied: ${input.promoDisplay}.`
    : "";

  if (kind === "addon") {
    return withFlipviseInboxSignature(
      `Thank you for unlocking the ${input.planLabel} add-on on your Flipvise account.` +
        amountClause +
        ` This add-on is active now and renews separately from your base plan; you may cancel the add-on anytime in Billing without ending your plan.` +
        ` A copy of this confirmation is kept in your inbox for your records.`,
    );
  }

  if (kind === "plan_change") {
    return withFlipviseInboxSignature(
      `Thank you for confirming your plan change to ${input.planLabel}.` +
        amountClause +
        promoClause +
        ` Your subscription has been updated with proration for the remainder of the current billing period.` +
        ` You can review receipts and manage renewal in Billing. This confirmation is saved in your inbox.`,
    );
  }

  return withFlipviseInboxSignature(
    `Thank you for subscribing to the ${input.planLabel} plan on Flipvise.` +
      amountClause +
      promoClause +
      trialInboxClause(input.trial, billing) +
      ` Your subscription is active, and paid features for this plan are available on your personal dashboard.` +
      ` You can manage billing, receipts, and cancellation from your profile → Billing. This confirmation is saved in your inbox.`,
  );
}
