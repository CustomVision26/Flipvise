import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nextMasteryLevel } from "./ai-recall-mastery";

describe("nextMasteryLevel", () => {
  it("moves new → learning on incorrect", () => {
    assert.equal(nextMasteryLevel("new", "incorrect", 20), "learning");
  });

  it("moves learning → strong on high correct score", () => {
    assert.equal(nextMasteryLevel("learning", "correct", 95), "strong");
  });

  it("moves strong → mastered on high correct score", () => {
    assert.equal(nextMasteryLevel("strong", "correct", 92), "mastered");
  });

  it("demotes after forced unlock", () => {
    assert.equal(nextMasteryLevel("mastered", "forced_unlock", null), "learning");
  });
});
