import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseDeckSubjectTopic, resolveDeckSubjectAndTopic } from "./deck-subject-topic";

describe("parseDeckSubjectTopic", () => {
  it("keeps Science : Environmental Science as subject and Air pollution as topic for quiz decks", () => {
    const parsed = parseDeckSubjectTopic({
      name: "Science : Environmental Science — Air pollution LP Day 1",
      description:
        "Air pollution · Science : Environmental Science · Grade grade 7 · Intermediate difficulty · Teacher quiz deck · Lesson scope: Day 1",
    });
    assert.equal(parsed.subject, "Science : Environmental Science");
    assert.equal(parsed.topic, "Air pollution");
  });

  it("parses bullet-separated quiz descriptions the same way", () => {
    const parsed = parseDeckSubjectTopic({
      name: "Science : Environmental Science — Air pollution LP Day 1",
      description:
        "Air pollution • Science : Environmental Science • Grade grade 7 • Intermediate difficulty • Teacher quiz deck • Lesson",
    });
    assert.equal(parsed.subject, "Science : Environmental Science");
    assert.equal(parsed.topic, "Air pollution");
  });

  it("does not dump a teacher-quiz description into topic", () => {
    const parsed = resolveDeckSubjectAndTopic({
      name: "Science : Environmental Science — Air pollution LP Day 1",
      description:
        "Air pollution • Science : Environmental Science • Grade grade 7 • Intermediate difficulty • Teacher quiz deck • Lesson",
    });
    assert.equal(parsed.topic, "Air pollution");
    assert.doesNotMatch(parsed.topic, /Teacher quiz deck/i);
  });

  it("uses Description/Topic as topic for ordinary decks", () => {
    const parsed = resolveDeckSubjectAndTopic({
      name: "Mathematics",
      description: "Linear equations",
    });
    assert.equal(parsed.subject, "Mathematics");
    assert.equal(parsed.topic, "Linear equations");
  });

  it("splits a Subject — Topic deck name when description is empty", () => {
    const parsed = parseDeckSubjectTopic({
      name: "Science : Environmental Science — Air pollution",
      description: "",
    });
    assert.equal(parsed.subject, "Science : Environmental Science");
    assert.equal(parsed.topic, "Air pollution");
  });
});
