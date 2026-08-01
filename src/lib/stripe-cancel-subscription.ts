import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import {
  basePlanPriceIdFromSubscription,
  isStripeAddonSubscription,
  isStripeAddonSubscriptionItem,
} from "@/lib/stripe-addon-metadata";
import {
  findActiveSubscriptionForClerkUser,
  syncActiveSubscriptionFromStripeForUser,
} from "@/lib/stripe-billing-sync";

export type CancelSubscriptionPreview = {
  planLabel: string;
  periodEnd: string;
  billingInterval: "month" | "year" | null;
  cancelAtPeriodEnd: boolean;
  /** Stripe subscription id used for the base plan preview (never an add-on sub). */
  stripeSubscriptionId: string;
};

function basePlanSubscriptionItem(
  sub: Stripe.Subscription,
): Stripe.SubscriptionItem | null {
  for (const item of sub.items.data) {
    if (!isStripeAddonSubscriptionItem(item)) return item;
  }
  return sub.items.data[0] ?? null;
}

function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const item = basePlanSubscriptionItem(sub);
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
  const item = basePlanSubscriptionItem(sub);
  const price = item?.price;
  const interval = price?.recurring?.interval;
  if (interval === "month" || interval === "year") return interval;
  // Fallback: look up via base plan price id when expanded price is missing.
  void basePlanPriceIdFromSubscription(sub);
  return null;
}

export async function fetchCancelSubscriptionPreview(
  stripeSubscriptionId: string,
  planSlug: string | null,
  options?: { clerkUserId?: string | null },
): Promise<CancelSubscriptionPreview> {
  let subId = stripeSubscriptionId.trim();
  let sub = await stripe.subscriptions.retrieve(subId, {
    expand: ["items.data.price"],
  });

  // Never treat an add-on subscription as the base plan (would show false "Renewal canceled").
  if (isStripeAddonSubscription(sub) && options?.clerkUserId) {
    const resolved = await findActiveSubscriptionForClerkUser(options.clerkUserId);
    if (resolved) {
      sub = await stripe.subscriptions.retrieve(resolved.sub.id, {
        expand: ["items.data.price"],
      });
      subId = sub.id;
      await syncActiveSubscriptionFromStripeForUser(options.clerkUserId).catch(
        (error) => {
          console.error(
            "[fetchCancelSubscriptionPreview] repair base plan row",
            error,
          );
        },
      );
    }
  }

  const periodEndDate = subscriptionPeriodEnd(sub);
  const planLabel = planSlug
    ? displayNameForBillingPlanSlug(planSlug)
    : "Paid plan";

  return {
    planLabel,
    periodEnd: periodEndDate?.toISOString() ?? new Date().toISOString(),
    billingInterval: billingIntervalFromSubscription(sub),
    cancelAtPeriodEnd: sub.cancel_at_period_end === true,
    stripeSubscriptionId: subId,
  };
}

/** Resume base-plan renewals after cancel_at_period_end was scheduled. */
export async function resumeSubscriptionRenewal(
  stripeSubscriptionId: string,
): Promise<{ periodEnd: string; cancelAtPeriodEnd: boolean }> {
  const updated = await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: false,
  });
  const periodEndDate = subscriptionPeriodEnd(updated);
  return {
    periodEnd: periodEndDate?.toISOString() ?? new Date().toISOString(),
    cancelAtPeriodEnd: updated.cancel_at_period_end === true,
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
