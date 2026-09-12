import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  stripSensitiveQueryFromPath,
  stripSensitiveUrlSearchParams,
} from "./sensitive-url-query";

describe("stripSensitiveUrlSearchParams", () => {
  it("removes Clerk and Stripe identifiers", () => {
    const params = new URLSearchParams({
      userid: "user_abc",
      session_id: "cs_live_secret",
      checkout: "success",
      team: "12",
    });
    const cleaned = stripSensitiveUrlSearchParams(params);
    assert.equal(cleaned.get("userid"), null);
    assert.equal(cleaned.get("session_id"), null);
    assert.equal(cleaned.get("checkout"), "success");
    assert.equal(cleaned.get("team"), "12");
  });

  it("keeps setup_intent so plan-change toast can finalize, but strips the client secret", () => {
    const params = new URLSearchParams({
      checkout: "plan_change",
      setup_intent: "seti_abc",
      setup_intent_client_secret: "seti_abc_secret_xyz",
    });
    const cleaned = stripSensitiveUrlSearchParams(params, "/dashboard");
    assert.equal(cleaned.get("setup_intent"), "seti_abc");
    assert.equal(cleaned.get("setup_intent_client_secret"), null);
    assert.equal(cleaned.get("checkout"), "plan_change");
  });

  it("strips plan from the dashboard path only", () => {
    const params = new URLSearchParams({ plan: "education_plus", checkout: "success" });
    const dash = stripSensitiveUrlSearchParams(params, "/dashboard");
    assert.equal(dash.get("plan"), null);
    assert.equal(dash.get("checkout"), "success");

    const checkout = stripSensitiveUrlSearchParams(
      new URLSearchParams({ plan: "education_plus", period: "monthly" }),
      "/pricing/checkout",
    );
    assert.equal(checkout.get("plan"), "education_plus");
  });
});

describe("stripSensitiveQueryFromPath", () => {
  it("cleans dashboard bookmarks", () => {
    assert.equal(
      stripSensitiveQueryFromPath(
        "/dashboard?userid=user_x&plan=education_plus&checkout=success",
      ),
      "/dashboard?checkout=success",
    );
  });

  it("keeps teamMemberId on team-admin routes", () => {
    assert.equal(
      stripSensitiveQueryFromPath(
        "/dashboard/team-admin/members?team=12&teamMemberId=4",
      ),
      "/dashboard/team-admin/members?team=12&teamMemberId=4",
    );
  });

  it("strips teamMemberId from the main dashboard", () => {
    assert.equal(
      stripSensitiveQueryFromPath("/dashboard?team=12&teamMemberId=4"),
      "/dashboard?team=12",
    );
  });
});
