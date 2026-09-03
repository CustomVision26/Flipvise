import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  subscriptionCheckoutConfirmationDescription,
  subscriptionCheckoutConfirmationTitle,
} from "./subscription-checkout-inbox-copy";

const trial = {
  startedAt: new Date(Date.UTC(2026, 8, 2, 20, 4, 1)),
  endsAt: new Date(Date.UTC(2026, 8, 9, 20, 4, 1)),
  chargeAt: new Date(Date.UTC(2026, 8, 9, 20, 4, 1)),
};

describe("subscription checkout inbox trial copy", () => {
  it("marks a trial confirmation in the title", () => {
    assert.equal(
      subscriptionCheckoutConfirmationTitle({
        planLabel: "Pro Plus",
        planSlug: "pro_plus",
        checkoutSessionId: "cs_live_test",
        trial,
      }),
      "Subscription confirmed — Pro Plus (free trial)",
    );
  });

  it("includes trial start, end, and first renewal charge dates", () => {
    const body = subscriptionCheckoutConfirmationDescription({
      planLabel: "Pro Plus",
      planSlug: "pro_plus",
      checkoutSessionId: "cs_live_test",
      period: "monthly",
      amountCents: 0,
      currency: "usd",
      promoDisplay: null,
      trial,
    });
    assert.match(body, /free trial that started September 2, 2026/);
    assert.match(body, /ends September 9, 2026/);
    assert.match(body, /renewal charge will be billed on September 9, 2026/);
    assert.match(body, /Regards,\nFlipvise Team by Flipvise Studio LLC$/);
    assert.equal(body.split("Flipvise Team by Flipvise Studio LLC").length - 1, 1);
  });
});
