import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stripeCheckoutElementsSessionParams } from "./stripe-checkout-branding";

describe("stripeCheckoutElementsSessionParams", () => {
  it("does not lock checkout to cards or hide Link", () => {
    const params = stripeCheckoutElementsSessionParams();
    assert.equal(params.ui_mode, "elements");
    assert.equal("payment_method_types" in params, false);
    assert.equal("wallet_options" in params, false);
  });
});
