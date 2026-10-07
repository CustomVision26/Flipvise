import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  lessonPlanDeckDescriptionMarker,
  parseLessonPlanIdFromDeckDescription,
} from "./lesson-plan-deck-marker";

describe("parseLessonPlanIdFromDeckDescription", () => {
  it("reads Lesson plan #id from a quiz-deck description", () => {
    const description = [
      "Air pollution",
      "Science : Environmental Science",
      "Grade grade 7",
      "Intermediate difficulty",
      "Teacher quiz deck",
      "Lesson scope: Day 1",
      lessonPlanDeckDescriptionMarker(42),
    ].join(" · ");
    assert.equal(parseLessonPlanIdFromDeckDescription(description), 42);
  });

  it("returns null when no marker is present", () => {
    assert.equal(
      parseLessonPlanIdFromDeckDescription(
        "Air pollution • Science : Environmental Science • Teacher quiz deck",
      ),
      null,
    );
  });
});
