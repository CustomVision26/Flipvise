import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addonCheckoutPayHref,
  checkoutSessionCookieApiPath,
  planCheckoutPayHref,
} from "./checkout-session-url";

describe("checkoutSessionCookieApiPath", () => {
  it("strips session_id from the next path", () => {
    const href = checkoutSessionCookieApiPath({
      sessionId: "cs_live_abc",
      nextPath: "/pricing/checkout/pay?session_id=cs_live_abc",
    });
    assert.equal(
      href,
      "/api/checkout-session?session_id=cs_live_abc&next=%2Fpricing%2Fcheckout%2Fpay",
    );
  });
});

describe("pay hrefs", () => {
  it("keeps pay pages free of session ids", () => {
    assert.equal(planCheckoutPayHref(), "/pricing/checkout/pay");
    assert.equal(addonCheckoutPayHref(), "/pricing/add-ons/pay");
    assert.equal(
      addonCheckoutPayHref(true),
      "/pricing/add-ons/pay?from_plan_change=1",
    );
  });
});
