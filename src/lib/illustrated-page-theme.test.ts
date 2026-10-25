import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveIllustratedPageTheme } from "./illustrated-page-theme";

describe("resolveIllustratedPageTheme", () => {
  it("uses the statistics side artwork for a mathematics deck", () => {
    const theme = resolveIllustratedPageTheme({
      name: "Math: Statistics and Data",
      description: "Learning Statistics and data with diagram and charts etc.",
    });
    assert.equal(theme.subject, "mathematics");
    assert.equal(theme.pattern, "math");
    assert.equal(theme.left, "/illustrated/backgrounds/math-left.png");
    assert.equal(theme.right, "/illustrated/backgrounds/math-right.png");
    assert.equal(theme.transparent, true);
    assert.equal(theme.leftWidth, 864);
    assert.equal(theme.leftHeight, 1152);
  });

  it("uses geometry tools beside a geometry deck instead of the chart sides", () => {
    const theme = resolveIllustratedPageTheme({
      name: "Math: Geometry",
      description: "Learning Geometry with diagrams working includedl",
    });
    assert.equal(theme.subject, "mathematics");
    assert.equal(theme.left, "/illustrated/backgrounds/geometry-left.png");
    assert.equal(theme.right, "/illustrated/backgrounds/geometry-right.png");
    assert.equal(theme.transparent, true);
  });

  it("places subject artwork in the navy outside a non-math deck", () => {
    const history = resolveIllustratedPageTheme({
      name: "British History",
      description: "Kings and charters",
    });
    assert.equal(history.subject, "history");
    assert.equal(history.left, "/illustrated/backgrounds/history-side-left.png");
    assert.equal(history.right, "/illustrated/backgrounds/history-side-right.png");
    assert.equal(history.transparent, true);
    assert.match(history.base, /linear-gradient/);

    const science = resolveIllustratedPageTheme({
      name: "Biology : Living organisms",
      description: "Learning the living organisms of life",
    });
    assert.equal(science.subject, "science");
    assert.equal(science.left, "/illustrated/backgrounds/science-side-left.png");
    assert.equal(science.right, "/illustrated/backgrounds/science-side-right.png");
  });

  it("maps reviewed titles onto one subject theme", () => {
    const cases: Array<[string, string]> = [
      ["Probability", "mathematics"],
      ["Algebra basics", "mathematics"],
      ["Biology and cells", "science"],
      ["Chemistry of acids", "science"],
      ["Environment and climate", "science"],
      ["Jamaican History", "history"],
      ["Grammar practice", "english"],
      ["Reading skills", "english"],
      ["World languages", "english"],
      ["Maps and capitals", "geography"],
      ["Weather and landscapes", "geography"],
      ["Study notes", "general"],
      ["Addition", "mathematics"],
      ["Spelling", "english"],
      ["Tenses", "english"],
      ["auto mechanics", "technology"],
    ];
    for (const [name, subject] of cases) {
      assert.equal(resolveIllustratedPageTheme({ name }).subject, subject, name);
    }
  });
});
