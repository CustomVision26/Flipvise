import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAdminBillingMonitorRows,
  groupAdminBillingMonitorRowsByUser,
} from "./billing-monitor-snapshot";
import type { listStripeSubscriptionsForAdmin } from "@/db/queries/stripe-subscriptions";

type StripeRow = Awaited<ReturnType<typeof listStripeSubscriptionsForAdmin>>[number];

function stripeRow(overrides: Partial<StripeRow> = {}): StripeRow {
  return {
    id: 1,
    userId: "user_1",
    stripeCustomerId: "cus_1",
    stripeSubscriptionId: "sub_1",
    stripeSubscriptionItemId: "si_1",
    planSlug: "pro_plus",
    status: "trialing",
    currentPeriodEnd: new Date("2026-09-09T20:04:01.000Z"),
    trialEnd: new Date("2026-09-09T20:04:01.000Z"),
    paymentFailedAt: null,
    createdAt: new Date("2026-09-02T20:04:01.000Z"),
    updatedAt: new Date("2026-09-02T20:04:01.000Z"),
    ...overrides,
  };
}

describe("buildAdminBillingMonitorRows", () => {
  it("keeps trial incidents off the subscription-expiring list and includes start, end, and first charge", () => {
    const rows = buildAdminBillingMonitorRows({
      stripeRows: [stripeRow()],
      trialRows: [],
      usersById: new Map([
        ["user_1", { fullName: "Jason Pottinger", email: "jason@example.com" }],
      ]),
      nowMs: Date.parse("2026-09-02T20:04:01.000Z"),
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.category, "active_trial");
    assert.match(rows[0]?.detail ?? "", /Trial started/);
    assert.match(rows[0]?.detail ?? "", /first charge/);
    assert.equal(
      rows.some((row) => row.category === "subscription_expiring"),
      false,
    );
  });

  it("groups multiple incidents for the same user", () => {
    const grouped = groupAdminBillingMonitorRowsByUser([
      {
        userId: "user_1",
        userName: "Jason Pottinger",
        email: "jason@example.com",
        planLabel: "Pro Plus",
        category: "active_trial",
        status: "trialing",
        eventAt: "2026-09-09T20:04:01.000Z",
        detail: "Trial started",
      },
      {
        userId: "user_1",
        userName: "Jason Pottinger",
        email: "jason@example.com",
        planLabel: "Pro Plus",
        category: "trial_ending_soon",
        status: "trialing",
        eventAt: "2026-09-09T20:04:01.000Z",
        detail: "Trial ending",
      },
    ]);
    assert.equal(grouped.length, 1);
    assert.equal(grouped[0]?.incidents.length, 2);
  });
});
