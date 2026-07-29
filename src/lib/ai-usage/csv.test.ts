import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { escapeCsvCell, rowsToCsv } from "./csv";

describe("escapeCsvCell", () => {
  it("neutralizes spreadsheet formula injection", () => {
    assert.equal(escapeCsvCell("=CMD()"), "'=CMD()");
    assert.equal(escapeCsvCell("+123"), "'+123");
    assert.equal(escapeCsvCell("-1+1"), "'-1+1");
    assert.equal(escapeCsvCell("@SUM(A1)"), "'@SUM(A1)");
  });

  it("quotes commas and quotes", () => {
    assert.equal(escapeCsvCell('a,b'), '"a,b"');
    assert.equal(escapeCsvCell('say "hi"'), '"say ""hi"""');
  });
});

describe("rowsToCsv", () => {
  it("builds a CSV with headers", () => {
    const csv = rowsToCsv(["name", "email"], [["Ada", "ada@example.com"]]);
    assert.equal(csv, "name,email\nAda,ada@example.com");
  });
});
