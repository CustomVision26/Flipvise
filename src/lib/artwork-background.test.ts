import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARTWORK_SCENES,
  artworkBackgroundPath,
  pickArtworkScene,
  resolveArtworkTheme,
  selectArtworkScene,
} from "./artwork-background";

describe("resolveArtworkTheme", () => {
  it("uses the resolved light or dark theme", () => {
    assert.equal(resolveArtworkTheme("light"), "light");
    assert.equal(resolveArtworkTheme("dark"), "dark");
  });

  it("does not paint from an unresolved or system value", () => {
    assert.equal(resolveArtworkTheme("system"), null);
    assert.equal(resolveArtworkTheme(undefined), null);
    assert.equal(resolveArtworkTheme(null), null);
  });
});

describe("artworkBackgroundPath", () => {
  it("keeps light mode on light files and dark mode on dark files", () => {
    for (const scene of ARTWORK_SCENES) {
      const light = artworkBackgroundPath(scene, "light");
      const dark = artworkBackgroundPath(scene, "dark");
      assert.match(light, new RegExp(`${scene}-light\\.png$`));
      assert.doesNotMatch(light, /dark/);
      assert.match(dark, new RegExp(`${scene}-dark\\.png$`));
      assert.doesNotMatch(dark, /light/);
    }
  });

  it("keeps the same scene when the theme changes", () => {
    assert.equal(
      artworkBackgroundPath("woodland", "light"),
      "/artwork/backgrounds/woodland-light.png",
    );
    assert.equal(
      artworkBackgroundPath("woodland", "dark"),
      "/artwork/backgrounds/woodland-dark.png",
    );
  });
});

describe("selectArtworkScene", () => {
  it("does not replace a scene that is already stored", () => {
    assert.equal(selectArtworkScene("learning", () => 0), "learning");
    assert.equal(selectArtworkScene("discovery", () => 0.1), "discovery");
  });

  it("picks once when nothing is stored", () => {
    assert.equal(selectArtworkScene(null, () => 0), "woodland");
    assert.equal(selectArtworkScene("", () => 0.34), "learning");
    assert.equal(selectArtworkScene("nope", () => 0.9), "discovery");
  });

  it("stays inside the catalog", () => {
    assert.equal(pickArtworkScene(() => 0), "woodland");
    assert.equal(pickArtworkScene(() => 0.999), "discovery");
  });
});
