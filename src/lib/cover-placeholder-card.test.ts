import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCoverPlaceholderCard } from "./cover-placeholder-card";

describe("isCoverPlaceholderCard", () => {
  it("matches the Create Deck cover stub", () => {
    assert.equal(
      isCoverPlaceholderCard({
        front: "",
        back: "Add the answer on this side",
        frontImageUrl: "https://example.com/cover.png",
        backImageUrl: null,
        aiGenerated: false,
      }),
      true,
    );
  });

  it("matches an empty-back cover stub", () => {
    assert.equal(
      isCoverPlaceholderCard({
        front: "  ",
        back: "",
        frontImageUrl: "https://example.com/cover.png",
        backImageUrl: null,
        aiGenerated: false,
      }),
      true,
    );
  });

  it("does not match a real flashcard", () => {
    assert.equal(
      isCoverPlaceholderCard({
        front: "What event in 1066 changed English history?",
        back: "The Norman Conquest",
        frontImageUrl: "https://example.com/cover.png",
        backImageUrl: null,
        aiGenerated: true,
      }),
      false,
    );
  });
});
