import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultAboutPageContent,
  parseAboutPageContent,
  publicAboutFeatures,
  publicAboutLeaders,
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

  it("keeps saved leaders visible when the published flag is missing", () => {
    const content = defaultAboutPageContent();
    const stored = {
      ...content,
      leaders: content.leaders.map(({ published: _published, ...leader }) => leader),
    };
    const parsed = parseAboutPageContent(stored);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.content.leaders.every((leader) => leader.published), true);
  });

  it("shows only published leaders on the public page", () => {
    const content = defaultAboutPageContent();
    content.leaders[0]!.published = false;
    const visible = publicAboutLeaders(content);
    assert.equal(
      visible.some((leader) => leader.id === content.leaders[0]!.id),
      false,
    );
    assert.equal(visible.length, content.leaders.length - 1);
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
