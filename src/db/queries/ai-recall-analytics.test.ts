import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeSessionAnalytics } from "./ai-recall";
import type { AiRecallPerCardSnapshot } from "@/lib/ai-recall-types";

describe("computeSessionAnalytics", () => {
  it("aggregates outcomes and average AI score", () => {
    const perCard: AiRecallPerCardSnapshot[] = [
      {
        cardId: 1,
        question: "Q1",
        correctAnswer: "A1",
        studentAnswer: "A1",
        outcome: "correct",
        score: 100,
        confidence: 90,
        feedback: "Great",
        explanation: "…",
        recallTimeMs: 4000,
        modality: "text",
      },
      {
        cardId: 2,
        question: "Q2",
        correctAnswer: "A2",
        studentAnswer: "wrong",
        outcome: "incorrect",
        score: 20,
        confidence: 80,
        feedback: "No",
        explanation: "…",
        recallTimeMs: 6000,
        modality: "text",
      },
      {
        cardId: 3,
        question: "Q3",
        correctAnswer: "A3",
        studentAnswer: null,
        outcome: "forced_unlock",
        score: null,
        confidence: null,
        feedback: null,
        explanation: "…",
        recallTimeMs: 2000,
        modality: "text",
      },
    ];

    const stats = computeSessionAnalytics({
      perCard,
      sessionDurationMs: 60_000,
      masteredCards: 1,
      needsReview: 2,
    });

    assert.equal(stats.cardsReviewed, 3);
    assert.equal(stats.correct, 1);
    assert.equal(stats.incorrect, 1);
    assert.equal(stats.forcedUnlocks, 1);
    assert.equal(stats.averageRecallTimeMs, 4000);
    assert.equal(stats.averageAiScore, 60);
    assert.equal(stats.masteredCards, 1);
    assert.equal(stats.needsReview, 2);
    assert.equal(stats.sessionDurationMs, 60_000);
  });
});
