import type Stripe from "stripe";
import {
  cancelStripeAddonEntitlementBySubscription,
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

/** Cancel Stripe billing for a user's add-on (standalone sub or line item). */
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
