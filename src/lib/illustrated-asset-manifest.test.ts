import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ILLUSTRATED_ASSET_MANIFEST,
  illustratedAssetFitsDisplay,
  selectIllustratedAsset,
} from "./illustrated-asset-manifest";

const statisticsHero = ILLUSTRATED_ASSET_MANIFEST.find((asset) => asset.id === "statistics-hero");
const statisticsTile = ILLUSTRATED_ASSET_MANIFEST.find(
  (asset) => asset.path === "/illustrated/reference-bank/tiles/statistics.webp",
);

describe("illustrated asset metadata", () => {
  it("records the statistics header as an approved transparent hero", () => {
    assert.ok(statisticsHero);
    assert.equal(statisticsHero.role, "hero");
    assert.equal(statisticsHero.subject, "mathematics");
    assert.equal(statisticsHero.topic, "statistics");
    assert.equal(statisticsHero.width, 1024);
    assert.equal(statisticsHero.height, 1024);
    assert.equal(statisticsHero.transparent, true);
    assert.equal(statisticsHero.reviewStatus, "approved");
    assert.deepEqual(statisticsHero.suitableDisplay, { width: 512, height: 512 });
  });

  it("keeps reference boards out of the interface catalog's usable set", () => {
    const boards = ILLUSTRATED_ASSET_MANIFEST.filter((asset) => asset.role === "board");
    assert.ok(boards.length > 0);
    assert.ok(boards.every((asset) => asset.reviewStatus === "rejected"));
  });
});

describe("selectIllustratedAsset", () => {
  it("uses the transparent statistics hero for the deck header", () => {
    const choice = selectIllustratedAsset({
      role: "hero",
      subject: "mathematics",
      text: "Math: Statistics and Data",
      displayWidth: 448,
      displayHeight: 280,
      devicePixelRatio: 2,
    });
    assert.equal(choice.asset?.path, "/illustrated/statistics-hero.png");
    assert.equal(choice.missingPath, null);
  });

  it("does not enlarge the statistics reference crop into a hero or a gallery card", () => {
    assert.ok(statisticsTile);
    assert.equal(statisticsTile.width, 251);
    assert.equal(statisticsTile.height, 119);
    assert.equal(
      illustratedAssetFitsDisplay(statisticsTile, 448, 280, 2),
      false,
    );
    assert.equal(
      illustratedAssetFitsDisplay(statisticsTile, 360, 160, 2),
      false,
    );

    const header = selectIllustratedAsset({
      role: "hero",
      subject: "mathematics",
      text: "statistics probability",
      displayWidth: 448,
      displayHeight: 280,
      devicePixelRatio: 2,
    });
    const card = selectIllustratedAsset({
      role: "card-cover",
      subject: "mathematics",
      text: "statistics",
      displayWidth: 360,
      displayHeight: 160,
      devicePixelRatio: 2,
    });
    assert.notEqual(header.asset?.path, statisticsTile.path);
    assert.notEqual(card.asset?.path, statisticsTile.path);
    assert.equal(card.asset?.role, "card-cover");
  });

  it("picks a dedicated cover instead of the first keyword hit", () => {
    const choice = selectIllustratedAsset({
      role: "card-cover",
      subject: "mathematics",
      text: "A spinner lands on a probability",
      displayWidth: 360,
      displayHeight: 160,
      devicePixelRatio: 2,
    });
    assert.equal(choice.asset?.id, "probability");
    assert.equal(choice.asset?.path, "/illustrated/topics/probability.jpg");
  });

  it("assigns the statistics gallery covers by topic", () => {
    const data = selectIllustratedAsset({
      role: "card-cover",
      subject: "mathematics",
      text: "Find the mean of this data set",
      displayWidth: 360,
      displayHeight: 160,
      devicePixelRatio: 2,
    });
    const percent = selectIllustratedAsset({
      role: "card-cover",
      subject: "mathematics",
      text: "What percentage of the budget is left?",
      displayWidth: 360,
      displayHeight: 160,
      devicePixelRatio: 2,
    });
    assert.equal(data.asset?.id, "data-analysis");
    assert.equal(percent.asset?.id, "percentages");
    assert.notEqual(data.asset?.path, "/illustrated/topics/data-bars.jpg");
  });

  it("gives the sales and survey cards their own covers", () => {
    const sales = selectIllustratedAsset({
      role: "card-cover",
      subject: "mathematics",
      text: "Sales by day: Mon 40, Tue 55, Wed 30, Thu 70, Fri 60. On which day were sales highest?",
      displayWidth: 360,
      displayHeight: 160,
      devicePixelRatio: 2,
    });
    const survey = selectIllustratedAsset({
      role: "card-cover",
      subject: "mathematics",
      text: "A class surveyed favorite sports: Soccer 12, Basketball 8, Tennis 5, Swimming 3. Which sport was chosen most?",
      displayWidth: 360,
      displayHeight: 160,
      devicePixelRatio: 2,
    });
    assert.equal(sales.asset?.path, "/illustrated/topics/sales.jpg");
    assert.equal(survey.asset?.path, "/illustrated/topics/survey.jpg");
    assert.equal(sales.missingPath, null);
    assert.equal(survey.missingPath, null);
  });

  it("rotates the statistics covers when the card does not name a topic", () => {
    const first = selectIllustratedAsset({
      role: "card-cover",
      subject: "mathematics",
      text: "Statistics practice",
      displayWidth: 360,
      displayHeight: 160,
      devicePixelRatio: 2,
      variantIndex: 0,
    });
    const second = selectIllustratedAsset({
      role: "card-cover",
      subject: "mathematics",
      text: "Statistics practice",
      displayWidth: 360,
      displayHeight: 160,
      devicePixelRatio: 2,
      variantIndex: 1,
    });
    assert.equal(first.asset?.id, "probability");
    assert.equal(second.asset?.id, "data-analysis");
  });

  it("blends a transparent history hero and covers cards that have no picture", () => {
    const header = selectIllustratedAsset({
      role: "hero",
      subject: "history",
      text: "America History Learning America History 19th century",
      displayWidth: 448,
      displayHeight: 280,
      devicePixelRatio: 2,
    });
    assert.equal(header.asset?.path, "/illustrated/history-hero.png");
    assert.equal(header.asset?.transparent, true);

    const cards: Array<[string, string]> = [
      ["The establishment of local governments by the colonists", "/illustrated/topics/history-colonial.jpg"],
      ["What is significant about modern America?", "/illustrated/topics/history-modern.jpg"],
      ["What period in U.S. history included the Great Depression and World War II", "/illustrated/topics/history-depression.jpg"],
      ["What did the U.S. Constitution establish?", "/illustrated/topics/history-constitution.jpg"],
      ["What was the main outcome of the American Civil War", "/illustrated/topics/history-civil-war.jpg"],
      ["What was the significance of the Declaration of Independence", "/illustrated/topics/history-declaration.jpg"],
    ];
    for (const [text, path] of cards) {
      const card = selectIllustratedAsset({
        role: "card-cover",
        subject: "history",
        text,
        displayWidth: 360,
        displayHeight: 160,
        devicePixelRatio: 2,
      });
      assert.equal(card.asset?.path, path, text);
      assert.equal(card.missingPath, null);
    }
  });

  it("blends the states and towns header and gives each capital its own cover", () => {
    const header = selectIllustratedAsset({
      role: "hero",
      subject: "geography",
      text: "States and Town Learning States and Towns",
      displayWidth: 448,
      displayHeight: 280,
      devicePixelRatio: 2,
    });
    assert.equal(header.asset?.path, "/illustrated/states-town-header.png");
    assert.equal(header.asset?.transparent, true);

    const covers = ["Albany", "Austin", "Sacramento", "Columbus"].map((text) =>
      selectIllustratedAsset({
        role: "card-cover",
        subject: "geography",
        text,
        displayWidth: 360,
        displayHeight: 160,
        devicePixelRatio: 2,
      }).asset?.path,
    );
    assert.deepEqual(covers, [
      "/illustrated/topics/town-albany.jpg",
      "/illustrated/topics/town-austin.jpg",
      "/illustrated/topics/town-sacramento.jpg",
      "/illustrated/topics/town-columbus.jpg",
    ]);
    assert.equal(new Set(covers).size, 4);
  });

  it("uses a different english cover for each unmatched gallery card", () => {
    const first = selectIllustratedAsset({
      role: "card-cover",
      subject: "english",
      text: "French to English words",
      displayWidth: 360,
      displayHeight: 160,
      devicePixelRatio: 2,
      variantIndex: 0,
    });
    const second = selectIllustratedAsset({
      role: "card-cover",
      subject: "english",
      text: "French to English words",
      displayWidth: 360,
      displayHeight: 160,
      devicePixelRatio: 2,
      variantIndex: 1,
    });
    assert.equal(first.missingPath, null);
    assert.equal(second.missingPath, null);
    assert.notEqual(first.asset?.path, second.asset?.path);
    assert.match(first.asset?.path ?? "", /^\/illustrated\/topics\/lang-/);
  });

  it("gives named vocabulary cards their own covers", () => {
    const door = selectIllustratedAsset({
      role: "card-cover",
      subject: "english",
      text: "Door",
      displayWidth: 360,
      displayHeight: 160,
      devicePixelRatio: 2,
    });
    const house = selectIllustratedAsset({
      role: "card-cover",
      subject: "english",
      text: "House",
      displayWidth: 360,
      displayHeight: 160,
      devicePixelRatio: 2,
    });
    assert.equal(door.asset?.path, "/illustrated/topics/lang-door.jpg");
    assert.equal(house.asset?.path, "/illustrated/topics/lang-house.jpg");
  });

  it("rotates a math gallery card that has no topic cover", () => {
    const choice = selectIllustratedAsset({
      role: "card-cover",
      subject: "mathematics",
      text: "The temperature increased by several degrees",
      displayWidth: 360,
      displayHeight: 160,
      devicePixelRatio: 2,
    });
    assert.equal(choice.missingPath, null);
    assert.match(choice.asset?.path ?? "", /^\/illustrated\/topics\/math-/);
    assert.notEqual(choice.asset?.id, "probability");
    assert.notEqual(choice.asset?.id, "sales");
  });

  it("blends a transparent header for every subject", () => {
    const cases: Array<[string, string, string]> = [
      ["mathematics", "Math: Geometry Learning Geometry", "/illustrated/math-hero.png"],
      ["english", "French to English learning French to English words", "/illustrated/english-hero.png"],
      ["science", "Science : Biology Learning Human Biology", "/illustrated/science-hero.png"],
      ["geography", "Geography - Plate Tectonics", "/illustrated/geography-hero.png"],
      ["technology", "auto mechanics four stroke", "/illustrated/technology-hero.png"],
      ["general", "Study notes", "/illustrated/general-hero.png"],
    ];
    for (const [subject, text, path] of cases) {
      const header = selectIllustratedAsset({
        role: "hero",
        subject: subject as "mathematics",
        text,
        displayWidth: 448,
        displayHeight: 280,
        devicePixelRatio: 2,
      });
      assert.equal(header.asset?.path, path, text);
      assert.equal(header.asset?.transparent, true, text);
    }
  });

  it("allows a reference crop only when the slot is small enough", () => {
    const thumb = selectIllustratedAsset({
      role: "card-cover",
      subject: "mathematics",
      text: "algebraic expressions",
      displayWidth: 40,
      displayHeight: 40,
      devicePixelRatio: 2,
    });
    const card = selectIllustratedAsset({
      role: "card-cover",
      subject: "mathematics",
      text: "algebraic expressions",
      displayWidth: 360,
      displayHeight: 160,
      devicePixelRatio: 2,
    });
    assert.equal(thumb.asset?.path, "/illustrated/reference-bank/tiles/algebra.webp");
    assert.notEqual(card.asset?.path, "/illustrated/reference-bank/tiles/algebra.webp");
  });

  it("flags a missing file instead of substituting a board or an undersized crop", () => {
    const choice = selectIllustratedAsset({
      role: "hero",
      subject: "mathematics",
      text: "statistics",
      displayWidth: 2000,
      displayHeight: 2000,
      devicePixelRatio: 2,
    });
    assert.equal(choice.asset, null);
    assert.equal(choice.missingPath, "public/illustrated/heroes/mathematics.png");

    const board = selectIllustratedAsset({
      role: "board",
      subject: "mathematics",
      text: "mathematics",
      displayWidth: 40,
      displayHeight: 40,
      devicePixelRatio: 1,
    });
    assert.equal(board.asset, null);
  });
});
