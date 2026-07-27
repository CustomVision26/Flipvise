import type Stripe from "stripe";

export const STRIPE_ADDON_META_TYPE = "addon" as const;

export function isStripeAddonSubscription(
  sub: Pick<Stripe.Subscription, "metadata">,
): boolean {
  return sub.metadata?.type === STRIPE_ADDON_META_TYPE;
}

export function isStripeAddonSubscriptionItem(
  item: Pick<Stripe.SubscriptionItem, "metadata">,
): boolean {
  return item.metadata?.type === STRIPE_ADDON_META_TYPE;
}

export function addonKeyFromStripeSubscription(
  sub: Pick<Stripe.Subscription, "metadata">,
): string | null {
  if (!isStripeAddonSubscription(sub)) return null;
  const key = sub.metadata?.addonKey?.trim();
  return key || null;
}

export function addonKeyFromStripeSubscriptionItem(
  item: Pick<Stripe.SubscriptionItem, "metadata">,
): string | null {
  if (!isStripeAddonSubscriptionItem(item)) return null;
  const key = item.metadata?.addonKey?.trim();
  return key || null;
}

/** First non-add-on subscription item price id (base plan line). */
export function basePlanPriceIdFromSubscription(
  sub: Stripe.Subscription,
): string | null {
  for (const item of sub.items?.data ?? []) {
    if (isStripeAddonSubscriptionItem(item)) continue;
    const priceId =
      typeof item.price === "string" ? item.price : item.price?.id ?? null;
    if (priceId) return priceId;
  }
  return null;
}
