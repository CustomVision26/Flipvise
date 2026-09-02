import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  STRIPE_TEST_CARD_ON_PRODUCTION_MESSAGE,
  formatStripeCheckoutPaymentError,
} from "./stripe-checkout-payment-error";

describe("formatStripeCheckoutPaymentError", () => {
  it("rewrites Stripe’s test-card-on-production decline without live mode", () => {
    const out = formatStripeCheckoutPaymentError(
      "Your card was declined. Your request was in live mode, but used a known test card.",
    );
    assert.equal(out, STRIPE_TEST_CARD_ON_PRODUCTION_MESSAGE);
    assert.equal(/live mode/i.test(out), false);
    assert.equal(/declined/i.test(out), false);
  });

  it("leaves ordinary Stripe messages unchanged", () => {
    assert.equal(
      formatStripeCheckoutPaymentError("Your card has insufficient funds."),
      "Your card has insufficient funds.",
    );
  });

  it("rewrites other live-mode copy without using that phrase", () => {
    const out = formatStripeCheckoutPaymentError(
      "Your request was in live mode, but used a test payment method.",
    );
    assert.equal(/live mode/i.test(out), false);
    assert.match(out, /genuine credit or debit card/i);
  });

  it("uses a generic fallback when the message is empty", () => {
    assert.equal(
      formatStripeCheckoutPaymentError(""),
      "Payment could not be completed. Please try again.",
    );
  });
});
