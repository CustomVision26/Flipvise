import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";
import { selectIllustratedAsset } from "./illustrated-asset-manifest";
import { ILLUSTRATED_DECK_BANK, resolveDeckCover } from "./illustrated-deck-bank";

describe("illustrated deck bank", () => {
  it("imports 64 decorative covers and keeps the files on disk", () => {
    assert.equal(ILLUSTRATED_DECK_BANK.length, 64);
    assert.equal(new Set(ILLUSTRATED_DECK_BANK.map((asset) => asset.id)).size, 64);
    for (const asset of ILLUSTRATED_DECK_BANK) {
      assert.equal(asset.selectionEnabled, true);
      assert.equal(asset.reviewStatus, "approved-decorative");
      assert.equal(asset.verifiedTeachingDiagram, false);
      assert.equal(asset.transparent, false);
      assert.equal(asset.role, "deck-cover");
      assert.equal(asset.sourceWidth, 1536);
      assert.equal(asset.sourceHeight, 1024);
      assert.equal(
        existsSync(resolve("public", asset.path.replace(/^\//, ""))),
        true,
        asset.path,
      );
    }
  });

  it("matches a deck from its title and keeps a custom cover", () => {
    const geometry = resolveDeckCover({
      name: "Math: Geometry",
      description: "Learning Geometry with diagrams",
    });
    assert.equal(geometry.source, "deck-bank");
    assert.equal(geometry.assetId, "geometry");
    assert.equal(geometry.url, "/illustrated/deck-bank/geometry.png");

    const statistics = resolveDeckCover({
      name: "Math: Statistics and Data",
      description: "Learning Statistics and data with diagrams and charts",
    });
    assert.equal(statistics.assetId, "statistics-data");

    const probability = resolveDeckCover({
      name: "Statistics and Probability",
      description: "Chance experiments",
    });
    assert.equal(probability.assetId, "statistics-probability");

    const custom = resolveDeckCover({
      name: "Math: Geometry",
      description: "Learning Geometry",
      coverImageUrl: "https://example.com/my-cover.jpg",
    });
    assert.equal(custom.source, "custom");
    assert.equal(custom.url, "https://example.com/my-cover.jpg");
    assert.equal(custom.assetId, null);
  });

  it("does not borrow a specific national cover or a small reference crop", () => {
    const america = resolveDeckCover({
      name: "America History",
      description: "Learning America History 19th century",
    });
    assert.equal(america.source, "hero");
    assert.equal(america.assetId, null);

    const jamaica = resolveDeckCover({
      name: "Social Studies: Jamaican History",
      description: "learning the history of Jamaica",
    });
    assert.equal(jamaica.assetId, "jamaican-heritage");

    const french = resolveDeckCover({
      name: "French to English.",
      description: "learning French to English words",
    });
    assert.notEqual(french.assetId, "spanish-everyday");

    const header = selectIllustratedAsset({
      role: "hero",
      subject: "mathematics",
      text: "Math: Geometry Learning Geometry",
      displayWidth: 448,
      displayHeight: 280,
      devicePixelRatio: 2,
    });
    assert.equal(header.asset?.transparent, true);
    assert.equal(header.asset?.path.endsWith("deck-bank/geometry.png"), false);
  });
});
