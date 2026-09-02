/** Shown when Stripe rejects a test PAN on a paid (non-sandbox) Checkout session. */
export const STRIPE_TEST_CARD_ON_PRODUCTION_MESSAGE =
  "This payment could not be completed. Test card numbers are not accepted on this checkout. Please use a genuine credit or debit card issued by your bank.";

/**
 * Rewrites Stripe decline copy for customers.
 * Stripe’s default mentions “live mode” and “declined” when a test card is used
 * on production — replace that with formal language.
 */
export function formatStripeCheckoutPaymentError(
  raw: string | null | undefined,
): string {
  const message = raw?.trim() || "Payment could not be completed. Please try again.";
  if (
    /known test card/i.test(message) ||
    (/test card/i.test(message) && /live mode/i.test(message))
  ) {
    return STRIPE_TEST_CARD_ON_PRODUCTION_MESSAGE;
  }
  if (/live mode/i.test(message)) {
    return "This payment could not be completed. Please use a genuine credit or debit card and try again.";
  }
  return message;
}
