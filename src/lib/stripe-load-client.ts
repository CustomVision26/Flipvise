import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { sanitizeStripePublishableKey } from "@/lib/stripe-publishable-key";

const stripePromiseByKey = new Map<string, Promise<Stripe | null>>();

export function getStripePromise(
  publishableKey?: string | null,
): Promise<Stripe | null> {
  const key =
    sanitizeStripePublishableKey(publishableKey) ??
    sanitizeStripePublishableKey(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  if (!key) {
    return Promise.resolve(null);
  }
  let promise = stripePromiseByKey.get(key);
  if (!promise) {
    promise = loadStripe(key);
    stripePromiseByKey.set(key, promise);
  }
  return promise;
}
