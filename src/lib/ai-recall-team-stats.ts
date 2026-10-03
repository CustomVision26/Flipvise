import type { AiRecallPerCardSnapshot } from "@/lib/ai-recall-types";

export type TeamAiRecallSessionSummary = {
  id: number;
  userId: string;
  memberLabel: string;
  deckId: number | null;
  deckName: string;
  savedAt: string;
  cardsReviewed: number;
  correct: number;
  incorrect: number;
  forcedUnlocks: number;
  accuracy: number | null;
  averageAiScore: number | null;
  sessionDurationMs: number;
};

export type TeamAiRecallMemberRollup = {
  userId: string;
  memberLabel: string;
  sessions: number;
  cardsReviewed: number;
  correct: number;
  accuracy: number | null;
  averageAiScore: number | null;
  averageSessionTimeMs: number | null;
  lastSavedAt: string | null;
  misses: number;
};

export type TeamAiRecallDeckRollup = {
  key: string;
  deckId: number | null;
  deckName: string;
  sessions: number;
  memberCount: number;
  cardsReviewed: number;
  correct: number;
  accuracy: number | null;
  averageAiScore: number | null;
  averageSessionTimeMs: number | null;
  lastSavedAt: string | null;
  misses: number;
};

export type TeamAiRecallDashboardStats = {
  /** Saved AI Recall™ sessions included in the rollup (capped query window). */
  sessionCount: number;
  teamRecallAccuracy: number | null;
  averageAiScore: number | null;
  averageSessionTimeMs: number | null;
  mostMissedCards: { question: string; misses: number }[];
  mostMissedDecks: { deckName: string; misses: number }[];
  topLearners: {
    userId: string;
    memberLabel: string;
    averageScore: number;
    sessions: number;
  }[];
  weakestSubjects: { deckName: string; averageScore: number }[];
  members: TeamAiRecallMemberRollup[];
  decks: TeamAiRecallDeckRollup[];
  sessions: TeamAiRecallSessionSummary[];
};

export type TeamAiRecallSessionAggregateInput = {
  id: number;
  userId: string;
  deckId: number | null;
  deckName: string;
  cardsReviewed: number;
  correct: number;
  incorrect: number;
  forcedUnlocks: number;
  averageAiScore: number | null;
  sessionDurationMs: number;
  savedAt: Date;
  perCard: AiRecallPerCardSnapshot[] | null;
};

function emptyTeamAiRecallDashboardStats(): TeamAiRecallDashboardStats {
  return {
    sessionCount: 0,
    teamRecallAccuracy: null,
    averageAiScore: null,
    averageSessionTimeMs: null,
    mostMissedCards: [],
    mostMissedDecks: [],
    topLearners: [],
    weakestSubjects: [],
    members: [],
    decks: [],
    sessions: [],
  };
}

function ratioPercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

function meanRounded(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function toIso(value: Date): string {
  return value.toISOString();
}

export function deckRollupKey(deckId: number | null, deckName: string): string {
  return deckId != null ? `id:${deckId}` : `name:${deckName}`;
}

/** Pure rollup of saved AI Recall™ sessions for Team Admin monitoring. */
export function buildTeamAiRecallDashboardStats(
  sessions: TeamAiRecallSessionAggregateInput[],
): TeamAiRecallDashboardStats {
  if (sessions.length === 0) return emptyTeamAiRecallDashboardStats();

  const totalCorrect = sessions.reduce((sum, row) => sum + row.correct, 0);
  const totalReviewed = sessions.reduce((sum, row) => sum + row.cardsReviewed, 0);
  const teamRecallAccuracy = ratioPercent(totalCorrect, totalReviewed);
  const averageAiScore = meanRounded(
    sessions
      .map((row) => row.averageAiScore)
      .filter((score): score is number => score != null),
  );
  const averageSessionTimeMs = Math.round(
    sessions.reduce((sum, row) => sum + row.sessionDurationMs, 0) /
      sessions.length,
  );

  const cardMisses = new Map<string, number>();
  const members = new Map<
    string,
    {
      cardsReviewed: number;
      correct: number;
      misses: number;
      scoreTotal: number;
      scoreCount: number;
      durationTotal: number;
      lastSavedAt: Date;
      sessionIds: number[];
    }
  >();
  const decks = new Map<
    string,
    {
      deckId: number | null;
      deckName: string;
      cardsReviewed: number;
      correct: number;
      misses: number;
      scoreTotal: number;
      scoreCount: number;
      durationTotal: number;
      lastSavedAt: Date;
      memberIds: Set<string>;
      sessionIds: number[];
    }
  >();

  const summaries: TeamAiRecallSessionSummary[] = sessions.map((row) => {
    const misses = row.incorrect + row.forcedUnlocks;
    const savedAt = toIso(row.savedAt);
    const member =
      members.get(row.userId) ??
      {
        cardsReviewed: 0,
        correct: 0,
        misses: 0,
        scoreTotal: 0,
        scoreCount: 0,
        durationTotal: 0,
        lastSavedAt: row.savedAt,
        sessionIds: [],
      };
    member.cardsReviewed += row.cardsReviewed;
    member.correct += row.correct;
    member.misses += misses;
    member.durationTotal += row.sessionDurationMs;
    member.sessionIds.push(row.id);
    if (row.averageAiScore != null) {
      member.scoreTotal += row.averageAiScore;
      member.scoreCount += 1;
    }
    if (row.savedAt.getTime() > member.lastSavedAt.getTime()) {
      member.lastSavedAt = row.savedAt;
    }
    members.set(row.userId, member);

    const key = deckRollupKey(row.deckId, row.deckName);
    const deck =
      decks.get(key) ??
      {
        deckId: row.deckId,
        deckName: row.deckName,
        cardsReviewed: 0,
        correct: 0,
        misses: 0,
        scoreTotal: 0,
        scoreCount: 0,
        durationTotal: 0,
        lastSavedAt: row.savedAt,
        memberIds: new Set<string>(),
        sessionIds: [],
      };
    deck.cardsReviewed += row.cardsReviewed;
    deck.correct += row.correct;
    deck.misses += misses;
    deck.durationTotal += row.sessionDurationMs;
    deck.memberIds.add(row.userId);
    deck.sessionIds.push(row.id);
    if (row.averageAiScore != null) {
      deck.scoreTotal += row.averageAiScore;
      deck.scoreCount += 1;
    }
    if (row.savedAt.getTime() > deck.lastSavedAt.getTime()) {
      deck.lastSavedAt = row.savedAt;
    }
    decks.set(key, deck);

    for (const card of row.perCard ?? []) {
      if (card.outcome === "incorrect" || card.outcome === "forced_unlock") {
        const question = card.question?.trim() || `Card #${card.cardId}`;
        cardMisses.set(question, (cardMisses.get(question) ?? 0) + 1);
      }
    }

    return {
      id: row.id,
      userId: row.userId,
      memberLabel: row.userId,
      deckId: row.deckId,
      deckName: row.deckName,
      savedAt,
      cardsReviewed: row.cardsReviewed,
      correct: row.correct,
      incorrect: row.incorrect,
      forcedUnlocks: row.forcedUnlocks,
      accuracy: ratioPercent(row.correct, row.cardsReviewed),
      averageAiScore: row.averageAiScore,
      sessionDurationMs: row.sessionDurationMs,
    };
  });

  summaries.sort((a, b) => b.savedAt.localeCompare(a.savedAt));

  const memberRollups: TeamAiRecallMemberRollup[] = [...members.entries()].map(
    ([userId, value]) => ({
      userId,
      memberLabel: userId,
      sessions: value.sessionIds.length,
      cardsReviewed: value.cardsReviewed,
      correct: value.correct,
      accuracy: ratioPercent(value.correct, value.cardsReviewed),
      averageAiScore:
        value.scoreCount > 0
          ? Math.round(value.scoreTotal / value.scoreCount)
          : null,
      averageSessionTimeMs:
        value.sessionIds.length > 0
          ? Math.round(value.durationTotal / value.sessionIds.length)
          : null,
      lastSavedAt: toIso(value.lastSavedAt),
      misses: value.misses,
    }),
  );
  memberRollups.sort((a, b) => {
    const byDate = (b.lastSavedAt ?? "").localeCompare(a.lastSavedAt ?? "");
    if (byDate !== 0) return byDate;
    return a.memberLabel.localeCompare(b.memberLabel);
  });

  const deckRollups: TeamAiRecallDeckRollup[] = [...decks.entries()].map(
    ([key, value]) => ({
      key,
      deckId: value.deckId,
      deckName: value.deckName,
      sessions: value.sessionIds.length,
      memberCount: value.memberIds.size,
      cardsReviewed: value.cardsReviewed,
      correct: value.correct,
      accuracy: ratioPercent(value.correct, value.cardsReviewed),
      averageAiScore:
        value.scoreCount > 0
          ? Math.round(value.scoreTotal / value.scoreCount)
          : null,
      averageSessionTimeMs:
        value.sessionIds.length > 0
          ? Math.round(value.durationTotal / value.sessionIds.length)
          : null,
      lastSavedAt: toIso(value.lastSavedAt),
      misses: value.misses,
    }),
  );
  deckRollups.sort((a, b) => {
    const byDate = (b.lastSavedAt ?? "").localeCompare(a.lastSavedAt ?? "");
    if (byDate !== 0) return byDate;
    return a.deckName.localeCompare(b.deckName);
  });

  const mostMissedCards = [...cardMisses.entries()]
    .map(([question, misses]) => ({ question, misses }))
    .sort((a, b) => b.misses - a.misses)
    .slice(0, 8);

  const mostMissedDecks = [...deckRollups]
    .sort((a, b) => b.misses - a.misses)
    .slice(0, 8)
    .map((deck) => ({ deckName: deck.deckName, misses: deck.misses }));

  const topLearners = memberRollups
    .filter((member) => member.averageAiScore != null)
    .map((member) => ({
      userId: member.userId,
      memberLabel: member.memberLabel,
      averageScore: member.averageAiScore ?? 0,
      sessions: member.sessions,
    }))
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 8);

  const weakestSubjects = [...deckRollups]
    .filter((deck) => deck.misses > 0)
    .sort((a, b) => (a.averageAiScore ?? 0) - (b.averageAiScore ?? 0))
    .slice(0, 5)
    .map((deck) => ({
      deckName: deck.deckName,
      averageScore: deck.averageAiScore ?? 0,
    }));

  return {
    sessionCount: sessions.length,
    teamRecallAccuracy,
    averageAiScore,
    averageSessionTimeMs,
    mostMissedCards,
    mostMissedDecks,
    topLearners,
    weakestSubjects,
    members: memberRollups,
    decks: deckRollups,
    sessions: summaries,
  };
}
