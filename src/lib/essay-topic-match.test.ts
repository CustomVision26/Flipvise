/**
 * @vitest-environment node
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  coreEssayTopic,
  heuristicEssayTopicMatch,
} from "./essay-topic-match";

describe("essay topic match", () => {
  it("strips type suffix from titles", () => {
    assert.equal(
      coreEssayTopic("E-Sports in Schools: Hobby or Legitimate Sport? — Cause and Effect"),
      "E-Sports in Schools: Hobby or Legitimate Sport?",
    );
  });

  it("matches writing about the assigned e-sports topic", () => {
    const result = heuristicEssayTopicMatch({
      topic: "E-Sports in Schools: Hobby or Legitimate Sport?",
      prompt: "Write a cause and effect essay about e-sports in schools for Year 1.",
      body: [
        "E-sports programs in schools can affect academic performance in several ways.",
        "When schools promote balance, e-sports can improve problem-solving skills and student motivation.",
      ].join(" "),
    });
    assert.equal(result.matches, true);
  });

  it("flags writing about a different topic", () => {
    const result = heuristicEssayTopicMatch({
      topic: "E-Sports in Schools: Hobby or Legitimate Sport?",
      prompt: "Write about e-sports in schools.",
      body: [
        "Although remote and hybrid learning became popular during the pandemic,",
        "most students should return to learning primarily in the classroom.",
        "Face-to-face instruction helps students stay focused.",
      ].join(" "),
    });
    assert.equal(result.matches, false);
    assert.equal(result.confidence, "high");
  });

  it("flags when distinctive topic terms are missing", () => {
    const result = heuristicEssayTopicMatch({
      topic: "E-Sports in Schools: Hobby or Legitimate Sport?",
      prompt: "Focus on effects of e-sports programs.",
      body: "Education matters for young people and teachers every day in modern life.",
    });
    assert.equal(result.matches, false);
  });
});
