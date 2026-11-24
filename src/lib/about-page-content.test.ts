import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultAboutPageContent,
  parseAboutPageContent,
  publicAboutFeatures,
} from "./about-page-content";

describe("parseAboutPageContent", () => {
  it("accepts the built-in page", () => {
    const parsed = parseAboutPageContent(defaultAboutPageContent());
    assert.equal(parsed.ok, true);
  });

  it("rejects a javascript contact link", () => {
    const content = defaultAboutPageContent();
    content.contactActions[0]!.href = "javascript:alert(1)";
    const parsed = parseAboutPageContent(content);
    assert.equal(parsed.ok, false);
  });

  it("rejects a non-LinkedIn profile link", () => {
    const content = defaultAboutPageContent();
    content.leaders[0]!.linkedInUrl = "https://example.com/profile";
    const parsed = parseAboutPageContent(content);
    assert.equal(parsed.ok, false);
  });

  it("hides features marked hidden", () => {
    const content = defaultAboutPageContent();
    content.features[0]!.availability = "hidden";
    const visible = publicAboutFeatures(content);
    assert.equal(
      visible.some((feature) => feature.id === content.features[0]!.id),
      false,
    );
  });
});
