import type { CheckoutSessionActionResult } from "@/actions/stripe";

/** Navigate after `createStripeCheckoutSessionAction` — in-place upgrade, custom pay page, or hosted URL. */
export function navigateAfterCheckoutSessionCreated(
  result: CheckoutSessionActionResult,
  navigate: (href: string) => void,
): void {
  if (result.upgradedInPlace && result.url) {
    window.location.href = result.url;
    return;
  }
  if (result.sessionId) {
    navigate(
      `/pricing/checkout/pay?session_id=${encodeURIComponent(result.sessionId)}`,
    );
    return;
  }
  if (result.url) {
    window.location.href = result.url;
  }
}
