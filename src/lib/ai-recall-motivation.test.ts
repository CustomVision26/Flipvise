import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeSessionAccuracyPercent,
  resolveMotivationTier,
  fallbackAiRecallMotivation,
} from "./ai-recall-motivation";

describe("ai-recall-motivation", () => {
  it("computes accuracy from correct / reviewed", () => {
    assert.equal(computeSessionAccuracyPercent(7, 8), 88);
    assert.equal(computeSessionAccuracyPercent(0, 0), 0);
    assert.equal(computeSessionAccuracyPercent(1, 2), 50);
  });

  it("maps score tiers", () => {
    assert.equal(resolveMotivationTier(49), "improve");
    assert.equal(resolveMotivationTier(50), "encourage");
    assert.equal(resolveMotivationTier(90), "encourage");
    assert.equal(resolveMotivationTier(91), "excellence");
    assert.equal(resolveMotivationTier(100), "excellence");
  });

  it("fallback excellence mentions flower and includes author", () => {
    const m = fallbackAiRecallMotivation(95);
    assert.equal(m.tier, "excellence");
    assert.match(m.title.toLowerCase(), /flower|excellence/);
    assert.equal(m.author, "Flipvise");
  });
});
