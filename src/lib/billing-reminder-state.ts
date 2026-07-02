import {
  formatPaymentGraceRemaining,
  isWithinPaymentGracePeriod,
  paymentGraceExpiresAt,
} from "@/lib/billing-grace-period";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import type { BillingNoticeStripeRow } from "@/lib/billing-inbox-notices";

export type BillingReminderKind =
  | "trial_ending"
  | "trial_expired"
  | "payment_grace"
  | "payment_grace_expired"
  | null;

export type BillingReminderState = {
  kind: BillingReminderKind;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  urgent: boolean;
};

export function resolveBillingReminderState(input: {
  stripeRow: BillingNoticeStripeRow | null;
  nowMs?: number;
}): BillingReminderState | null {
  const { stripeRow, nowMs = Date.now() } = input;
  if (!stripeRow) return null;

  const planSlug = stripeRow.planSlug ?? "pro_plus";
  const planLabel = displayNameForBillingPlanSlug(planSlug);
  const pricingHref = "/pricing";

  if (stripeRow.status === "trialing" && stripeRow.trialEnd) {
    const msUntilEnd = stripeRow.trialEnd.getTime() - nowMs;
    if (msUntilEnd > 0 && msUntilEnd <= 72 * 60 * 60 * 1000) {
      const ends = stripeRow.trialEnd.toLocaleDateString(undefined, {
        dateStyle: "long",
      });
      return {
        kind: "trial_ending",
        title: `${planLabel} trial ending soon`,
        description: `Your free trial ends on ${ends}. Subscribe to keep your features.`,
        ctaLabel: "Choose a plan",
        ctaHref: pricingHref,
        urgent: msUntilEnd <= 24 * 60 * 60 * 1000,
      };
    }
  }

  if (
    stripeRow.status === "past_due" &&
    stripeRow.paymentFailedAt &&
    isWithinPaymentGracePeriod(stripeRow.paymentFailedAt, nowMs)
  ) {
    const remaining = formatPaymentGraceRemaining(stripeRow.paymentFailedAt, nowMs);
    const graceEnd = paymentGraceExpiresAt(stripeRow.paymentFailedAt);
    return {
      kind: "payment_grace",
      title: "Payment failed — action required",
      description: `Update your payment method within ${remaining} (by ${graceEnd.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}) or your account reverts to Free.`,
      ctaLabel: "Update billing",
      ctaHref: pricingHref,
      urgent: true,
    };
  }

  if (
    stripeRow.status === "past_due" &&
    stripeRow.paymentFailedAt &&
    !isWithinPaymentGracePeriod(stripeRow.paymentFailedAt, nowMs)
  ) {
    return {
      kind: "payment_grace_expired",
      title: "Subscription lapsed",
      description: `Your ${planLabel} renewal was not completed. Subscribe again to restore paid features.`,
      ctaLabel: "Subscribe now",
      ctaHref: pricingHref,
      urgent: true,
    };
  }

  return null;
}
