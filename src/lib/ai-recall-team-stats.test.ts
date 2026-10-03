import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTeamAiRecallDashboardStats } from "./ai-recall-team-stats";

describe("buildTeamAiRecallDashboardStats", () => {
  it("rolls up saved sessions by member and by deck", () => {
    const stats = buildTeamAiRecallDashboardStats([
      {
        id: 1,
        userId: "user_a",
        deckId: 10,
        deckName: "British History",
        cardsReviewed: 4,
        correct: 2,
        incorrect: 1,
        forcedUnlocks: 1,
        averageAiScore: 40,
        sessionDurationMs: 120_000,
        savedAt: new Date("2026-10-03T12:00:00.000Z"),
        perCard: [
          {
            cardId: 1,
            question: "Who was Elizabeth I?",
            correctAnswer: "Queen",
            studentAnswer: "Queen",
            outcome: "correct",
            score: 80,
            confidence: 90,
            feedback: "Yes",
            explanation: "…",
            recallTimeMs: 3000,
            modality: "text",
          },
          {
            cardId: 2,
            question: "When was 1066?",
            correctAnswer: "1066",
            studentAnswer: "1200",
            outcome: "incorrect",
            score: 10,
            confidence: 80,
            feedback: "No",
            explanation: "…",
            recallTimeMs: 4000,
            modality: "text",
          },
        ],
      },
      {
        id: 2,
        userId: "user_b",
        deckId: 10,
        deckName: "British History",
        cardsReviewed: 2,
        correct: 2,
        incorrect: 0,
        forcedUnlocks: 0,
        averageAiScore: 90,
        sessionDurationMs: 60_000,
        savedAt: new Date("2026-10-03T13:00:00.000Z"),
        perCard: [],
      },
      {
        id: 3,
        userId: "user_a",
        deckId: 11,
        deckName: "Algebra",
        cardsReviewed: 2,
        correct: 0,
        incorrect: 2,
        forcedUnlocks: 0,
        averageAiScore: 15,
        sessionDurationMs: 45_000,
        savedAt: new Date("2026-10-03T14:00:00.000Z"),
        perCard: [
          {
            cardId: 9,
            question: "Solve for x",
            correctAnswer: "2",
            studentAnswer: "5",
            outcome: "incorrect",
            score: 15,
            confidence: 70,
            feedback: "No",
            explanation: "…",
            recallTimeMs: 5000,
            modality: "text",
          },
        ],
      },
    ]);

    assert.equal(stats.sessionCount, 3);
    assert.equal(stats.teamRecallAccuracy, 50);
    assert.equal(stats.members.length, 2);
    assert.equal(stats.decks.length, 2);

    const memberA = stats.members.find((m) => m.userId === "user_a");
    assert.ok(memberA);
    assert.equal(memberA.sessions, 2);
    assert.equal(memberA.cardsReviewed, 6);
    assert.equal(memberA.correct, 2);
    assert.equal(memberA.misses, 4);
    assert.equal(memberA.accuracy, 33);
    assert.equal(memberA.averageAiScore, 28);

    const history = stats.decks.find((d) => d.deckName === "British History");
    assert.ok(history);
    assert.equal(history.sessions, 2);
    assert.equal(history.memberCount, 2);
    assert.equal(history.accuracy, 67);
    assert.equal(history.averageAiScore, 65);

    assert.equal(stats.sessions[0]?.id, 3);
    assert.equal(stats.topLearners[0]?.userId, "user_b");
    assert.ok(stats.mostMissedCards.some((c) => c.question === "When was 1066?"));
  });

  it("returns empty rollups when there are no saved sessions", () => {
    const stats = buildTeamAiRecallDashboardStats([]);
    assert.equal(stats.sessionCount, 0);
    assert.equal(stats.members.length, 0);
    assert.equal(stats.decks.length, 0);
    assert.equal(stats.sessions.length, 0);
  });
});
