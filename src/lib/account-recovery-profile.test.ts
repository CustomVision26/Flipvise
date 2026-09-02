import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatMailingAddress } from "./account-recovery-profile";

describe("formatMailingAddress", () => {
  it("omits Parish from Jamaica parish names in the current-details summary", () => {
    assert.equal(
      formatMailingAddress({
        streetAddress: "100 march pen rd",
        city: "Spanish Town",
        stateProvince: "Saint Catherine Parish",
        postalCode: "",
        country: "Jamaica",
      }),
      "100 march pen rd\nSpanish Town, Saint Catherine\nJamaica",
    );
  });
});
