import type { CheckoutSessionActionResult } from "@/actions/stripe";
import { planCheckoutPayHref } from "@/lib/checkout-session-url";

/** Navigate after `createStripeCheckoutSessionAction` — in-place upgrade, custom pay page, or hosted URL. */
export function navigateAfterCheckoutSessionCreated(
  result: CheckoutSessionActionResult,
  navigate: (href: string) => void,
): void {
  if (result.error) {
    return;
  }
  if (result.upgradedInPlace && result.url) {
    window.location.href = result.url;
    return;
  }
  if (result.sessionId) {
    navigate(planCheckoutPayHref());
    return;
  }
  if (result.url) {
    window.location.href = result.url;
  }
}
