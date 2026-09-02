import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_JMD_PER_USD,
  jmdCurrencyOptionParams,
  usdCentsToJmdCents,
} from "./stripe-jmd-currency";

describe("usdCentsToJmdCents", () => {
  it("converts Enterprise monthly $260 at the BOJ rate", () => {
    assert.equal(usdCentsToJmdCents(26_000, DEFAULT_JMD_PER_USD), 4_139_460);
  });

  it("converts Enterprise yearly $3000 independently of the monthly amount", () => {
    assert.equal(usdCentsToJmdCents(300_000, DEFAULT_JMD_PER_USD), 47_763_000);
    assert.notEqual(usdCentsToJmdCents(300_000, DEFAULT_JMD_PER_USD), 4_115_488);
  });
});

describe("jmdCurrencyOptionParams", () => {
  it("sets exclusive tax behavior for Stripe Tax checkout", () => {
    const option = jmdCurrencyOptionParams(1_500, DEFAULT_JMD_PER_USD);
    assert.equal(option.tax_behavior, "exclusive");
    assert.equal(option.unit_amount, Math.round(1_500 * DEFAULT_JMD_PER_USD));
  });
});
