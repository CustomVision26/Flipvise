import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { persistableHttpImageUrl } from "./persistable-image-url";

describe("persistableHttpImageUrl", () => {
  it("keeps http(s) URLs", () => {
    assert.equal(
      persistableHttpImageUrl("https://d3867h453fl05i.cloudfront.net/card-images/a.webp"),
      "https://d3867h453fl05i.cloudfront.net/card-images/a.webp",
    );
    assert.equal(
      persistableHttpImageUrl("http://example.com/x.png"),
      "http://example.com/x.png",
    );
  });

  it("drops local previews and empty values", () => {
    assert.equal(persistableHttpImageUrl("blob:https://learn.flipvisestudio.com/abc"), null);
    assert.equal(persistableHttpImageUrl("data:image/webp;base64,abc"), null);
    assert.equal(persistableHttpImageUrl(""), null);
    assert.equal(persistableHttpImageUrl("   "), null);
    assert.equal(persistableHttpImageUrl(null), null);
    assert.equal(persistableHttpImageUrl(undefined), null);
  });
});
