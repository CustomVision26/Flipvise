import type Stripe from "stripe";
import type { BillingStatusValue } from "@/lib/plan-metadata-billing-resolution";
import {
  isWithinPaymentGracePeriod,
  PAYMENT_GRACE_PERIOD_MS,
} from "@/lib/billing-grace-period";

export { PAYMENT_GRACE_PERIOD_MS };

/**
 * Maps raw Stripe subscription status to Clerk `billingStatus`, honoring the
 * 12-hour grace window for `past_due` renewals.
 */
export function resolveClerkBillingStatusFromStripe(input: {
  stripeStatus: Stripe.Subscription.Status;
  paymentFailedAt: Date | null | undefined;
  nowMs?: number;
}): BillingStatusValue {
  const { stripeStatus, paymentFailedAt, nowMs = Date.now() } = input;

  if (stripeStatus === "active") return "active";
  if (stripeStatus === "trialing") return "trialing";
  if (stripeStatus === "canceled") return "canceled";

  if (stripeStatus === "past_due") {
    if (isWithinPaymentGracePeriod(paymentFailedAt, nowMs)) {
      return "active";
    }
    return "expired";
  }

  return "expired";
}

export function stripeSubscriptionTrialEnd(sub: Stripe.Subscription): Date | null {
  if (typeof sub.trial_end === "number" && sub.trial_end > 0) {
    return new Date(sub.trial_end * 1000);
  }
  return null;
}

export function shouldRetainPaidAccessFromStripeStatus(input: {
  stripeStatus: string;
  paymentFailedAt: Date | null | undefined;
  nowMs?: number;
}): boolean {
  const { stripeStatus, paymentFailedAt, nowMs = Date.now() } = input;
  if (stripeStatus === "active" || stripeStatus === "trialing") return true;
  if (stripeStatus === "past_due") {
    return isWithinPaymentGracePeriod(paymentFailedAt, nowMs);
  }
  return false;
}
