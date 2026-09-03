import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FLIPVISE_INBOX_SIGNATURE,
  withFlipviseInboxSignature,
} from "./flipvise-inbox-signature";

describe("withFlipviseInboxSignature", () => {
  it("appends the standard closing once", () => {
    const out = withFlipviseInboxSignature("Thank you for subscribing.");
    assert.equal(
      out,
      `Thank you for subscribing.\n\n${FLIPVISE_INBOX_SIGNATURE}`,
    );
    assert.equal(out.split("Flipvise Team by Flipvise Studio LLC").length - 1, 1);
  });

  it("strips a trailing signature before appending", () => {
    const alreadySigned =
      "Thank you for subscribing.\n\nRegards,\nFlipvise Team by Flipvise Studio LLC";
    const out = withFlipviseInboxSignature(alreadySigned);
    assert.equal(
      out,
      `Thank you for subscribing.\n\n${FLIPVISE_INBOX_SIGNATURE}`,
    );
    assert.equal(out.split("Flipvise Team by Flipvise Studio LLC").length - 1, 1);
  });
});
