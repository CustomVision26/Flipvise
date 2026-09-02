import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeStripePublishableKey } from "./stripe-publishable-key";

describe("sanitizeStripePublishableKey", () => {
  it("accepts live and test publishable keys", () => {
    assert.equal(
      sanitizeStripePublishableKey("pk_live_abc"),
      "pk_live_abc",
    );
    assert.equal(
      sanitizeStripePublishableKey("pk_test_abc"),
      "pk_test_abc",
    );
  });

  it("strips wrapping quotes and backticks from copied env values", () => {
    assert.equal(
      sanitizeStripePublishableKey("`pk_live_abc`"),
      "pk_live_abc",
    );
    assert.equal(
      sanitizeStripePublishableKey('"pk_test_abc"'),
      "pk_test_abc",
    );
  });

  it("rejects secret keys and empty values", () => {
    assert.equal(sanitizeStripePublishableKey("sk_live_abc"), null);
    assert.equal(sanitizeStripePublishableKey(""), null);
    assert.equal(sanitizeStripePublishableKey(undefined), null);
  });
});
