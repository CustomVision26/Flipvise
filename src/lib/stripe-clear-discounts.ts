import type Stripe from "stripe";

/**
 * Stripe inherits subscription/customer coupons on invoice preview and subscription
 * update unless explicitly cleared. An empty array leaves discounts unchanged;
 * only an empty string clears them.
 *
 * @see https://docs.stripe.com/api/invoices/create_preview
 * @see https://docs.stripe.com/api/subscriptions/update
 */
export const STRIPE_CLEAR_DISCOUNTS = "" as unknown as Stripe.Emptyable<
  Stripe.InvoiceCreatePreviewParams["discounts"]
>;

export const STRIPE_CLEAR_SUBSCRIPTION_DISCOUNTS =
  "" as unknown as Stripe.SubscriptionUpdateParams["discounts"];

export const STRIPE_CLEAR_SUBSCRIPTION_ITEM_DISCOUNTS =
  "" as unknown as Stripe.SubscriptionUpdateParams.Item["discounts"];
