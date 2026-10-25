import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  matchIllustratedReference,
  resolveIllustratedArtwork,
} from "./illustrated-reference-bank";

describe("matchIllustratedReference", () => {
  it("uses a specific scene before a broad subject hero", () => {
    assert.equal(
      matchIllustratedReference("Math: Algebra 1")?.id,
      "algebra",
    );
    assert.equal(
      matchIllustratedReference("Mathematics")?.id,
      "geometry",
    );
    assert.equal(
      matchIllustratedReference("Mathematics", { specificOnly: true }),
      null,
    );
  });

  it("does not treat a nearby word as a scene", () => {
    assert.equal(matchIllustratedReference("available"), null);
    assert.equal(
      matchIllustratedReference("Social Studies: British History"),
      null,
    );
    assert.equal(
      matchIllustratedReference("Jamaican History: Heritage")?.id,
      "jamaican-history",
    );
  });

  it("uses the earth and space stack unless a single scene is named", () => {
    assert.equal(matchIllustratedReference("Earth & Space")?.id, "earth-space-stack");
    assert.equal(
      matchIllustratedReference("Earth & Space: Solar System")?.id,
      "solar-system",
    );
    assert.equal(
      matchIllustratedReference("Earth & Space", { specificOnly: true }),
      null,
    );
  });

  it("matches answer text only when a scene phrase is present", () => {
    assert.equal(
      matchIllustratedReference("chlorophyll and photosynthesis", {
        specificOnly: true,
      })?.id,
      "photosynthesis",
    );
    assert.equal(
      matchIllustratedReference("Life Science", { specificOnly: true }),
      null,
    );
  });
});

describe("resolveIllustratedArtwork", () => {
  it("keeps an owner cover ahead of the reference bank", () => {
    const resolved = resolveIllustratedArtwork({
      name: "Algebra",
      coverImageUrl: "https://cdn.example/cover.png",
    });
    assert.equal(resolved.coverImageUrl, "https://cdn.example/cover.png");
    assert.equal(resolved.referenceImageUrl, null);
  });

  it("points a matching deck at a local tile and leaves other decks on the vector scene", () => {
    const algebra = resolveIllustratedArtwork({ name: "Algebraic Expressions" });
    assert.equal(algebra.referenceImageUrl, "/illustrated/reference-bank/tiles/algebra.webp");
    assert.equal(algebra.subject, "mathematics");

    const history = resolveIllustratedArtwork({
      name: "Social Studies: British History",
    });
    assert.equal(history.referenceImageUrl, null);
    assert.equal(history.subject, "history");
  });
});
