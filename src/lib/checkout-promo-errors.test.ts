import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CHECKOUT_GENERIC_RETRY_MESSAGE,
  checkoutErrorUserMessage,
  checkoutPlanChangeRequiredError,
  isProductionOmittedServerError,
} from "./checkout-promo-errors";

describe("checkoutErrorUserMessage", () => {
  it("replaces Next.js production-omitted Server Action errors", () => {
    const omitted =
      "An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details. A digest property is included on this error instance which may provide additional details about the nature of the error.";
    assert.equal(isProductionOmittedServerError(omitted), true);
    assert.equal(checkoutErrorUserMessage(omitted), CHECKOUT_GENERIC_RETRY_MESSAGE);
  });

  it("strips the plan-change-required prefix", () => {
    const err = checkoutPlanChangeRequiredError();
    assert.equal(
      checkoutErrorUserMessage(err.message).startsWith("You already have"),
      true,
    );
  });
});
