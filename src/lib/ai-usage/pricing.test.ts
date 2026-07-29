import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  estimateAiCostMicros,
  extractTokenUsage,
  formatMicrosAsUsd,
  getAiPricingVersion,
} from "./pricing";

describe("estimateAiCostMicros", () => {
  it("uses integer micros and never floats for gpt-4o", () => {
    const cost = estimateAiCostMicros({
      model: "gpt-4o",
      usage: {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        cachedInputTokens: 0,
        totalTokens: 2_000_000,
      },
    });
    // $2.50 input + $10.00 output = $12.50 = 12_500_000 micros
    assert.equal(cost, 12_500_000);
    assert.equal(Number.isInteger(cost), true);
  });

  it("applies cached input rates separately", () => {
    const cost = estimateAiCostMicros({
      model: "gpt-4o",
      usage: {
        inputTokens: 1_000_000,
        outputTokens: 0,
        cachedInputTokens: 1_000_000,
        totalTokens: 1_000_000,
      },
    });
    // fully cached → 1.25 / 1M
    assert.equal(cost, 1_250_000);
  });

  it("adds flat image cost when configured", () => {
    const cost = estimateAiCostMicros({
      model: "gpt-image-1-mini",
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      imageCount: 2,
    });
    assert.equal(cost, 40_000);
  });
});

describe("extractTokenUsage", () => {
  it("reads AI SDK usage fields", () => {
    assert.deepEqual(
      extractTokenUsage({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      }),
      {
        inputTokens: 10,
        outputTokens: 5,
        cachedInputTokens: 0,
        totalTokens: 15,
      },
    );
  });

  it("falls back for empty usage", () => {
    assert.deepEqual(extractTokenUsage(null), {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      totalTokens: 0,
    });
  });
});

describe("formatMicrosAsUsd", () => {
  it("formats micros as USD", () => {
    assert.match(formatMicrosAsUsd(1_250_000), /\$1\.25/);
  });
});

describe("pricing version", () => {
  it("exposes a pricing version identifier", () => {
    assert.ok(getAiPricingVersion().length > 0);
  });
});
