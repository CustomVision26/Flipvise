import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stripLatexArtifacts } from "./source-import-reading-passage";

describe("stripLatexArtifacts", () => {
  it("turns latex fractions into plain text and removes backslashes", () => {
    const cleaned = stripLatexArtifacts(
      "The probability of landing on Blue is \\( \\frac{2}{6} \\) or \\( \\frac{1}{3} \\)",
    );
    assert.equal(
      cleaned.trim(),
      "The probability of landing on Blue is 2/6 or 1/3",
    );
    assert.equal(cleaned.includes("\\"), false);
  });
});
