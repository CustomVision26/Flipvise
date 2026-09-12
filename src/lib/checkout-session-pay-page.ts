import { redirect } from "next/navigation";
import { readCheckoutSessionCookie } from "@/lib/checkout-session-cookie";
import { checkoutSessionCookieApiPath } from "@/lib/checkout-session-url";
import { isStripeCheckoutSessionId } from "@/lib/stripe-checkout-session-id";

/**
 * Pay pages never keep Stripe session ids in the address bar. Leftover query
 * values bounce through `/api/checkout-session` (sets an httpOnly cookie).
 */
export async function requirePayPageCheckoutSessionId(input: {
  urlSessionId?: string | null;
  nextPath: string;
  fallbackPath: string;
}): Promise<string> {
  const fromUrl = input.urlSessionId?.trim() ?? "";
  if (isStripeCheckoutSessionId(fromUrl)) {
    redirect(
      checkoutSessionCookieApiPath({
        sessionId: fromUrl,
        nextPath: input.nextPath,
      }),
    );
  }
  const fromCookie = await readCheckoutSessionCookie();
  if (fromCookie) return fromCookie;
  redirect(input.fallbackPath);
}
