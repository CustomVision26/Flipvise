import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";

export type CancelSubscriptionPreview = {
  planLabel: string;
  periodEnd: string;
  billingInterval: "month" | "year" | null;
  cancelAtPeriodEnd: boolean;
};

function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const item = sub.items.data[0];
  if (!item) return null;
  const itemAny = item as Stripe.SubscriptionItem & {
    current_period_end?: number;
  };
  if (typeof itemAny.current_period_end === "number") {
    return new Date(itemAny.current_period_end * 1000);
  }
  return null;
}

function billingIntervalFromSubscription(
  sub: Stripe.Subscription,
): "month" | "year" | null {
  const price = sub.items.data[0]?.price;
  const interval = price?.recurring?.interval;
  if (interval === "month" || interval === "year") return interval;
  return null;
}

export async function fetchCancelSubscriptionPreview(
  stripeSubscriptionId: string,
  planSlug: string | null,
): Promise<CancelSubscriptionPreview> {
  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ["items.data.price"],
  });

  const periodEndDate = subscriptionPeriodEnd(sub);
  const planLabel = planSlug
    ? displayNameForBillingPlanSlug(planSlug)
    : "Paid plan";

  return {
    planLabel,
    periodEnd: periodEndDate?.toISOString() ?? new Date().toISOString(),
    billingInterval: billingIntervalFromSubscription(sub),
    cancelAtPeriodEnd: sub.cancel_at_period_end === true,
  };
}

/**
 * Stops the next billing cycle (monthly or yearly). Access continues through the
 * current period end; Stripe applies proration rules on any final invoice per
 * your Dashboard settings.
 */
export async function scheduleSubscriptionCancelAtPeriodEnd(
  stripeSubscriptionId: string,
): Promise<{ periodEnd: string; cancelAtPeriodEnd: boolean }> {
  const updated = await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  const periodEndDate = subscriptionPeriodEnd(updated);

  return {
    periodEnd: periodEndDate?.toISOString() ?? new Date().toISOString(),
    cancelAtPeriodEnd: updated.cancel_at_period_end === true,
  };
}
