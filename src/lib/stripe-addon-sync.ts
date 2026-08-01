import type Stripe from "stripe";
import {
  cancelStripeAddonEntitlementBySubscription,
  listActiveUserAddonEntitlements,
  revokeUserAddonEntitlement,
  upsertActiveStripeAddonEntitlement,
} from "@/db/queries/addons";
import {
  addonKeyFromStripeSubscription,
  addonKeyFromStripeSubscriptionItem,
  isStripeAddonSubscription,
  isStripeAddonSubscriptionItem,
  STRIPE_ADDON_META_TYPE,
} from "@/lib/stripe-addon-metadata";
import { stripe } from "@/lib/stripe";

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Syncs DB entitlements from an add-on-only subscription (metadata.type = addon),
 * or from add-on items attached to a base plan subscription.
 */
export async function syncAddonEntitlementsFromStripeSubscription(
  sub: Stripe.Subscription,
  fallbackUserId?: string | null,
): Promise<void> {
  const userId =
    stringOrNull(sub.metadata?.clerkUserId) ?? stringOrNull(fallbackUserId);
  if (!userId) return;

  const retainsAccess = sub.status === "active" || sub.status === "trialing";

  if (isStripeAddonSubscription(sub)) {
    const addonKey = addonKeyFromStripeSubscription(sub);
    if (!addonKey) return;

    if (!retainsAccess) {
      await cancelStripeAddonEntitlementBySubscription(sub.id);
      return;
    }

    const item = sub.items?.data?.[0];
    await upsertActiveStripeAddonEntitlement({
      userId,
      addonKey,
      stripeSubscriptionId: sub.id,
      stripeSubscriptionItemId: item?.id ?? null,
    });
    return;
  }

  // Base plan subscription that may carry add-on line items.
  for (const item of sub.items?.data ?? []) {
    if (!isStripeAddonSubscriptionItem(item)) continue;
    const addonKey = addonKeyFromStripeSubscriptionItem(item);
    if (!addonKey) continue;

    if (!retainsAccess) {
      await cancelStripeAddonEntitlementBySubscription(sub.id);
      continue;
    }

    await upsertActiveStripeAddonEntitlement({
      userId,
      addonKey,
      stripeSubscriptionId: sub.id,
      stripeSubscriptionItemId: item.id,
    });
  }
}

/** Attach a monthly add-on price to an existing base-plan subscription. */
export async function attachAddonItemToSubscription(input: {
  subscriptionId: string;
  priceId: string;
  userId: string;
  addonKey: string;
}): Promise<Stripe.SubscriptionItem> {
  const item = await stripe.subscriptionItems.create({
    subscription: input.subscriptionId,
    price: input.priceId,
    quantity: 1,
    payment_behavior: "error_if_incomplete",
    proration_behavior: "create_prorations",
    metadata: {
      type: STRIPE_ADDON_META_TYPE,
      addonKey: input.addonKey,
      clerkUserId: input.userId,
    },
  });

  await upsertActiveStripeAddonEntitlement({
    userId: input.userId,
    addonKey: input.addonKey,
    stripeSubscriptionId: input.subscriptionId,
    stripeSubscriptionItemId: item.id,
  });

  return item;
}

/**
 * Cancel Stripe billing for a user's add-on only (standalone add-on
 * subscription or legacy add-on line item). Never cancels the base plan sub.
 */
export async function cancelStripeAddonBilling(input: {
  stripeSubscriptionId: string | null | undefined;
  stripeSubscriptionItemId: string | null | undefined;
}): Promise<void> {
  const subId = input.stripeSubscriptionId?.trim();
  if (!subId) return;

  try {
    const sub = await stripe.subscriptions.retrieve(subId, {
      expand: ["items.data"],
    });

    if (isStripeAddonSubscription(sub)) {
      if (sub.status === "active" || sub.status === "trialing" || sub.status === "past_due") {
        await stripe.subscriptions.cancel(subId);
      }
      return;
    }

    const itemId = input.stripeSubscriptionItemId?.trim();
    if (itemId) {
      await stripe.subscriptionItems.del(itemId, {
        proration_behavior: "create_prorations",
      });
    }
  } catch (error) {
    console.error("[cancelStripeAddonBilling]", subId, error);
  }
}

/**
 * Stop the next add-on renewal only. Access continues until the add-on period
 * ends. Does not touch the user's base plan (e.g. Education Gold) subscription.
 */
export async function scheduleStripeAddonCancelAtPeriodEnd(input: {
  stripeSubscriptionId: string;
}): Promise<{ periodEndIso: string; cancelAtPeriodEnd: boolean }> {
  const subId = input.stripeSubscriptionId.trim();
  const sub = await stripe.subscriptions.retrieve(subId, {
    expand: ["items.data"],
  });

  if (!isStripeAddonSubscription(sub)) {
    throw new Error(
      "This subscription is not an add-on. Cancel the plan separately if needed.",
    );
  }

  if (sub.status !== "active" && sub.status !== "trialing" && sub.status !== "past_due") {
    throw new Error("This add-on is not actively renewing.");
  }

  const updated = await stripe.subscriptions.update(subId, {
    cancel_at_period_end: true,
  });

  const item = updated.items.data[0] as
    | (Stripe.SubscriptionItem & { current_period_end?: number })
    | undefined;
  const periodEndUnix =
    typeof item?.current_period_end === "number"
      ? item.current_period_end
      : (updated as Stripe.Subscription & { current_period_end?: number })
          .current_period_end;

  return {
    periodEndIso:
      typeof periodEndUnix === "number"
        ? new Date(periodEndUnix * 1000).toISOString()
        : new Date().toISOString(),
    cancelAtPeriodEnd: updated.cancel_at_period_end === true,
  };
}

/** Resume add-on auto-renewal after cancel_at_period_end was scheduled. */
export async function resumeStripeAddonRenewal(input: {
  stripeSubscriptionId: string;
}): Promise<{ periodEndIso: string; cancelAtPeriodEnd: boolean }> {
  const subId = input.stripeSubscriptionId.trim();
  const sub = await stripe.subscriptions.retrieve(subId, {
    expand: ["items.data"],
  });

  if (!isStripeAddonSubscription(sub)) {
    throw new Error(
      "This subscription is not an add-on. Resume the plan separately if needed.",
    );
  }

  if (sub.status !== "active" && sub.status !== "trialing" && sub.status !== "past_due") {
    throw new Error("This add-on is not active, so renewal cannot be resumed.");
  }

  const updated = await stripe.subscriptions.update(subId, {
    cancel_at_period_end: false,
  });

  const item = updated.items.data[0] as
    | (Stripe.SubscriptionItem & { current_period_end?: number })
    | undefined;
  const periodEndUnix =
    typeof item?.current_period_end === "number"
      ? item.current_period_end
      : (updated as Stripe.Subscription & { current_period_end?: number })
          .current_period_end;

  return {
    periodEndIso:
      typeof periodEndUnix === "number"
        ? new Date(periodEndUnix * 1000).toISOString()
        : new Date().toISOString(),
    cancelAtPeriodEnd: updated.cancel_at_period_end === true,
  };
}

/**
 * When the base plan will stop renewing, also stop add-on renewals on the same
 * cadence. Access continues until period end while the plan is still paid.
 */
export async function scheduleStripeAddonsCancelAtPeriodEndForUser(
  userId: string,
): Promise<void> {
  const entitlements = await listActiveUserAddonEntitlements(userId);
  for (const row of entitlements) {
    if (row.source !== "stripe" || !row.stripeSubscriptionId) continue;
    try {
      await scheduleStripeAddonCancelAtPeriodEnd({
        stripeSubscriptionId: row.stripeSubscriptionId,
      });
    } catch (error) {
      console.error(
        "[scheduleStripeAddonsCancelAtPeriodEndForUser]",
        row.addonKey,
        row.stripeSubscriptionId,
        error,
      );
    }
  }
}

/**
 * User lost paid plan access (canceled / unpaid / grace expired → Free).
 * Immediately stop Stripe add-on billing and revoke Stripe-sourced entitlements.
 * Admin / team grants are left untouched (access still gated by plan eligibility).
 */
export async function revokeStripeAddonsAfterPaidPlanLoss(
  userId: string,
): Promise<void> {
  const entitlements = await listActiveUserAddonEntitlements(userId);
  for (const row of entitlements) {
    if (row.source !== "stripe") continue;

    await cancelStripeAddonBilling({
      stripeSubscriptionId: row.stripeSubscriptionId,
      stripeSubscriptionItemId: row.stripeSubscriptionItemId,
    });

    try {
      await revokeUserAddonEntitlement({
        userId,
        addonKey: row.addonKey,
        status: "canceled",
      });
    } catch (error) {
      console.error(
        "[revokeStripeAddonsAfterPaidPlanLoss] entitlement",
        row.addonKey,
        error,
      );
    }
  }
}
