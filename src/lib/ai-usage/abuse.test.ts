import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateSuspiciousUsage } from "./abuse";

describe("evaluateSuspiciousUsage", () => {
  it("does not flag normal activity", () => {
    const signal = evaluateSuspiciousUsage({
      requestsLastMinute: 2,
      failuresLastHour: 1,
      blockedLastHour: 0,
      costMicrosLastHour: 1000,
    });
    assert.equal(signal.flagged, false);
    assert.equal(signal.reasons.length, 0);
  });

  it("flags high volume, failures, blocked retries, and cost spikes", () => {
    const signal = evaluateSuspiciousUsage({
      requestsLastMinute: 50,
      failuresLastHour: 25,
      blockedLastHour: 15,
      costMicrosLastHour: 9_000_000,
    });
    assert.equal(signal.flagged, true);
    assert.ok(signal.reasons.length >= 3);
  });
});
