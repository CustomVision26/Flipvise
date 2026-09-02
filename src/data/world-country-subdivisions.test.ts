import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getStateProvinceNamesForCountry,
  isValidStateProvinceForCountry,
  matchListedStateProvince,
  stateProvinceToStripeCode,
  stripTrailingParishLabel,
} from "./world-country-subdivisions";

describe("stripTrailingParishLabel", () => {
  it("removes a trailing Parish word", () => {
    assert.equal(stripTrailingParishLabel("Clarendon Parish"), "Clarendon");
    assert.equal(stripTrailingParishLabel("Saint Catherine Parish"), "Saint Catherine");
    assert.equal(stripTrailingParishLabel("Saint Andrew"), "Saint Andrew");
  });
});

describe("matchListedStateProvince", () => {
  const options = ["Clarendon", "Saint Andrew", "Saint Catherine"];

  it("matches listed names and stored Parish suffixes", () => {
    assert.equal(matchListedStateProvince(options, "Saint Catherine"), "Saint Catherine");
    assert.equal(
      matchListedStateProvince(options, "Saint Catherine Parish"),
      "Saint Catherine",
    );
    assert.equal(matchListedStateProvince(options, ""), null);
  });
});

describe("Jamaica parish list", () => {
  it("omits Parish from dropdown names and still accepts the old suffix", async () => {
    const names = await getStateProvinceNamesForCountry("Jamaica");
    assert.ok(names.includes("Saint Catherine"));
    assert.ok(names.includes("Clarendon"));
    assert.ok(names.includes("Saint Andrew"));
    assert.equal(
      names.some((name) => /\bParish$/i.test(name)),
      false,
    );
    assert.equal(
      await isValidStateProvinceForCountry("Jamaica", "Saint Catherine"),
      true,
    );
    assert.equal(
      await isValidStateProvinceForCountry("Jamaica", "Saint Catherine Parish"),
      true,
    );
    assert.equal(await stateProvinceToStripeCode("JM", "Saint Catherine"), "14");
    assert.equal(await stateProvinceToStripeCode("JM", "Saint Catherine Parish"), "14");
  });
});
