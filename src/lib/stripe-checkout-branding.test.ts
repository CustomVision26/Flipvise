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

  it("excludes Cash App, Amazon Pay, and Klarna while keeping card and ACH", () => {
    const excluded = stripeCheckoutElementsSessionParams()
      .excluded_payment_method_types;
    assert.ok(excluded?.includes("cashapp"));
    assert.ok(excluded?.includes("amazon_pay"));
    assert.ok(excluded?.includes("klarna"));
    assert.equal(excluded?.includes("card"), false);
    assert.equal(excluded?.includes("us_bank_account"), false);
  });
});
