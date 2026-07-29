import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  previousEquivalentRange,
  resolveCalendarMonthPeriod,
  resolveDateRangePreset,
  resolveUsagePeriod,
} from "./period";

describe("resolveCalendarMonthPeriod", () => {
  it("returns a month window containing the reference date", () => {
    const at = new Date("2026-07-15T12:00:00.000Z");
    const period = resolveCalendarMonthPeriod(at, "UTC");
    assert.ok(period.start.getTime() <= at.getTime());
    assert.ok(at.getTime() < period.end.getTime());
    assert.equal(period.label, "2026-07");
  });
});

describe("resolveDateRangePreset", () => {
  it("clamps custom ranges to max days", () => {
    const range = resolveDateRangePreset(
      "custom",
      "2020-01-01",
      "2026-07-01",
      "UTC",
    );
    const days =
      (range.end.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000);
    assert.ok(days <= 367);
  });

  it("supports last_7_days", () => {
    const range = resolveDateRangePreset("last_7_days", null, null, "UTC");
    const days =
      (range.end.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000);
    assert.ok(days >= 6 && days <= 8);
  });
});

describe("previousEquivalentRange", () => {
  it("shifts by the same duration", () => {
    const start = new Date("2026-07-01T00:00:00.000Z");
    const end = new Date("2026-07-08T00:00:00.000Z");
    const prev = previousEquivalentRange(start, end);
    assert.equal(prev.end.getTime(), start.getTime());
    assert.equal(prev.end.getTime() - prev.start.getTime(), 7 * 24 * 60 * 60 * 1000);
  });
});

describe("resolveUsagePeriod", () => {
  it("prefers stripe billing window when end is in the future", () => {
    const at = new Date("2026-07-15T00:00:00.000Z");
    const periodEnd = new Date("2026-08-01T00:00:00.000Z");
    const period = resolveUsagePeriod({
      at,
      stripeCurrentPeriodEnd: periodEnd,
      billingInterval: "month",
    });
    assert.equal(period.label, "billing_period");
    assert.ok(period.start.getTime() < at.getTime());
    assert.equal(period.end.getTime(), periodEnd.getTime());
  });
});
