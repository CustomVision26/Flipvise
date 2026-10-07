import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  collapseRepeatedExampleLabel,
  formatVocabularyExampleLine,
  stripVocabularyExampleLabel,
} from "./lesson-plan-vocabulary-detail";

describe("vocabulary example labels", () => {
  it("strips a single Example: prefix", () => {
    assert.equal(
      stripVocabularyExampleLabel(
        "Example: A coal-fired power plant releasing sulfur dioxide is an example of a point source of pollution.",
      ),
      "A coal-fired power plant releasing sulfur dioxide is an example of a point source of pollution.",
    );
  });

  it("strips a duplicated Example: prefix", () => {
    assert.equal(
      stripVocabularyExampleLabel(
        "Example: Example: Car exhaust emits carbon monoxide and nitrogen oxides into the air.",
      ),
      "Car exhaust emits carbon monoxide and nitrogen oxides into the air.",
    );
  });

  it("formats one Example: label for PDF and preview", () => {
    assert.equal(
      formatVocabularyExampleLine("Example: Example: Runoff from urban stormwater carries oil."),
      "Example: Runoff from urban stormwater carries oil.",
    );
  });

  it("collapses a repeated Example: label on a PDF line", () => {
    assert.equal(
      collapseRepeatedExampleLabel(
        "  Example: Example: A coal-fired power plant releasing sulfur dioxide is an example of a point source of pollution.",
      ),
      "  Example: A coal-fired power plant releasing sulfur dioxide is an example of a point source of pollution.",
    );
  });
});
