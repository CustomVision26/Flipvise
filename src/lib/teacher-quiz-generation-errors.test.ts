import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatTeacherQuizGenerationError } from "./teacher-quiz-generation-errors";

describe("formatTeacherQuizGenerationError", () => {
  it("maps OpenAI schema errors to a formal message", () => {
    const message = formatTeacherQuizGenerationError(
      new Error(
        "Invalid schema for response_format 'response': In context=('properties', 'passage', 'properties', 'questions', 'items'), 'required' is required to be supplied and to be an array including every key in properties. Missing 'questionType'.",
      ),
    );
    assert.equal(
      message,
      "Reading passage generation failed due to a temporary formatting issue. Please try again.",
    );
  });

  it("maps diversity failures", () => {
    assert.equal(
      formatTeacherQuizGenerationError(
        new Error("PASSAGE_DIVERSITY_FAILED: too similar"),
      ),
      "The generator could not produce sufficiently different passages. Please try again.",
    );
  });

  it("hides long technical dumps", () => {
    const message = formatTeacherQuizGenerationError(
      new Error(`context=('properties', 'passage') ${"x".repeat(200)}`),
    );
    assert.equal(message, "Quiz generation could not be completed. Please try again.");
  });
});
