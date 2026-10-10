import { db } from "@/db";
import {
  aiRecallResultInboxMessages,
  aiRecallSessions,
  cardMastery,
  decks,
} from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { notifyNativeInboxPush } from "@/lib/notify-native-inbox-push";
import type {
  AiRecallPerCardSnapshot,
  AiRecallSessionAnalytics,
  CardMasteryLevel,
  RecallCardOutcome,
} from "@/lib/ai-recall-types";
import {
  isMasteredLevel,
  needsReviewLevel,
  nextMasteryLevel,
} from "@/lib/ai-recall-mastery";
import {
  buildTeamAiRecallDashboardStats,
  type TeamAiRecallDashboardStats,
} from "@/lib/ai-recall-team-stats";

export type {
  TeamAiRecallDashboardStats,
  TeamAiRecallDeckRollup,
  TeamAiRecallMemberRollup,
  TeamAiRecallSessionAggregateInput,
  TeamAiRecallSessionSummary,
} from "@/lib/ai-recall-team-stats";

export type SaveAiRecallSessionInput = {
  userId: string;
  deckId: number;
  deckName: string;
  teamId: number | null;
  analytics: AiRecallSessionAnalytics;
  perCard: AiRecallPerCardSnapshot[];
};

export async function saveAiRecallSession(input: SaveAiRecallSessionInput) {
  const [row] = await db
    .insert(aiRecallSessions)
    .values({
      userId: input.userId,
      deckId: input.deckId,
      deckName: input.deckName,
      teamId: input.teamId,
      cardsReviewed: input.analytics.cardsReviewed,
      correct: input.analytics.correct,
      incorrect: input.analytics.incorrect,
      forcedUnlocks: input.analytics.forcedUnlocks,
      averageRecallTimeMs: input.analytics.averageRecallTimeMs,
      averageAiScore: input.analytics.averageAiScore,
      masteredCards: input.analytics.masteredCards,
      needsReview: input.analytics.needsReview,
      sessionDurationMs: input.analytics.sessionDurationMs,
      perCard: input.perCard,
    })
    .returning();
  return row;
}

export async function upsertCardMasteryAfterRecall(input: {
  userId: string;
  cardId: number;
  deckId: number;
  outcome: RecallCardOutcome;
  score: number | null;
}): Promise<CardMasteryLevel> {
  const existing = await db
    .select()
    .from(cardMastery)
    .where(
      and(
        eq(cardMastery.userId, input.userId),
        eq(cardMastery.cardId, input.cardId),
      ),
    )
    .limit(1);

  const prev = existing[0];
  const prevLevel = (prev?.level as CardMasteryLevel | undefined) ?? "new";
  const level = nextMasteryLevel(prevLevel, input.outcome, input.score);
  const correctStreak =
    input.outcome === "correct"
      ? (prev?.correctStreak ?? 0) + 1
      : 0;
  const reviewCount = (prev?.reviewCount ?? 0) + 1;
  const now = new Date();

  if (prev) {
    await db
      .update(cardMastery)
      .set({
        level,
        lastScore: input.score,
        lastOutcome: input.outcome,
        correctStreak,
        reviewCount,
        updatedAt: now,
      })
      .where(
        and(
          eq(cardMastery.userId, input.userId),
          eq(cardMastery.cardId, input.cardId),
        ),
      );
  } else {
    await db.insert(cardMastery).values({
      userId: input.userId,
      cardId: input.cardId,
      deckId: input.deckId,
      level,
      lastScore: input.score,
      lastOutcome: input.outcome,
      correctStreak,
      reviewCount,
      updatedAt: now,
    });
  }

  return level;
}

export async function applyMasteryUpdatesForSession(input: {
  userId: string;
  deckId: number;
  perCard: AiRecallPerCardSnapshot[];
}): Promise<{ masteredCards: number; needsReview: number }> {
  let masteredCards = 0;
  let needsReview = 0;

  for (const card of input.perCard) {
    const level = await upsertCardMasteryAfterRecall({
      userId: input.userId,
      cardId: card.cardId,
      deckId: input.deckId,
      outcome: card.outcome,
      score: card.score,
    });
    if (isMasteredLevel(level)) masteredCards += 1;
    if (needsReviewLevel(level) || card.outcome === "forced_unlock") {
      needsReview += 1;
    }
  }

  return { masteredCards, needsReview };
}

export type TeacherAiRecallDashboardStats = {
  averageAiScore: number | null;
  averageRecallTimeMs: number | null;
  forcedUnlockCount: number;
  sessionCount: number;
  lowestPerformingDecks: { deckName: string; averageScore: number }[];
  highestPerformingDecks: { deckName: string; averageScore: number }[];
  monitor: TeamAiRecallDashboardStats;
};

export async function getTeacherAiRecallStatsForWorkspace(
  ownerOrAdminUserId: string,
  teamId: number | null,
): Promise<TeacherAiRecallDashboardStats> {
  const sessions =
    teamId != null
      ? await db
          .select()
          .from(aiRecallSessions)
          .where(eq(aiRecallSessions.teamId, teamId))
          .orderBy(desc(aiRecallSessions.savedAt))
          .limit(500)
      : await db
          .select()
          .from(aiRecallSessions)
          .where(eq(aiRecallSessions.userId, ownerOrAdminUserId))
          .orderBy(desc(aiRecallSessions.savedAt))
          .limit(500);

  const monitor = buildTeamAiRecallDashboardStats(
    sessions.map((row) => ({
      id: row.id,
      userId: row.userId,
      deckId: row.deckId,
      deckName: row.deckName,
      cardsReviewed: row.cardsReviewed,
      correct: row.correct,
      incorrect: row.incorrect,
      forcedUnlocks: row.forcedUnlocks,
      averageAiScore: row.averageAiScore,
      sessionDurationMs: row.sessionDurationMs,
      savedAt:
        row.savedAt instanceof Date ? row.savedAt : new Date(row.savedAt),
      perCard: row.perCard ?? null,
    })),
  );

  if (sessions.length === 0) {
    return {
      averageAiScore: null,
      averageRecallTimeMs: null,
      forcedUnlockCount: 0,
      sessionCount: 0,
      lowestPerformingDecks: [],
      highestPerformingDecks: [],
      monitor,
    };
  }

  const scored = sessions.filter((s) => s.averageAiScore != null);
  const averageAiScore =
    scored.length > 0
      ? Math.round(
          scored.reduce((sum, s) => sum + (s.averageAiScore ?? 0), 0) /
            scored.length,
        )
      : null;
  const averageRecallTimeMs = Math.round(
    sessions.reduce((sum, s) => sum + s.averageRecallTimeMs, 0) /
      sessions.length,
  );
  const forcedUnlockCount = sessions.reduce(
    (sum, s) => sum + s.forcedUnlocks,
    0,
  );

  const byDeck = new Map<string, { total: number; count: number }>();
  for (const s of sessions) {
    if (s.averageAiScore == null) continue;
    const key = s.deckName;
    const prev = byDeck.get(key) ?? { total: 0, count: 0 };
    prev.total += s.averageAiScore;
    prev.count += 1;
    byDeck.set(key, prev);
  }

  const deckAvgs = [...byDeck.entries()]
    .map(([deckName, v]) => ({
      deckName,
      averageScore: Math.round(v.total / v.count),
    }))
    .sort((a, b) => a.averageScore - b.averageScore);

  return {
    averageAiScore,
    averageRecallTimeMs,
    forcedUnlockCount,
    sessionCount: sessions.length,
    lowestPerformingDecks: deckAvgs.slice(0, 5),
    highestPerformingDecks: [...deckAvgs].reverse().slice(0, 5),
    monitor,
  };
}

export async function getTeamAiRecallStats(
  teamId: number,
): Promise<TeamAiRecallDashboardStats> {
  const sessions = await db
    .select()
    .from(aiRecallSessions)
    .where(eq(aiRecallSessions.teamId, teamId))
    .orderBy(desc(aiRecallSessions.savedAt))
    .limit(1000);

  return buildTeamAiRecallDashboardStats(
    sessions.map((row) => ({
      id: row.id,
      userId: row.userId,
      deckId: row.deckId,
      deckName: row.deckName,
      cardsReviewed: row.cardsReviewed,
      correct: row.correct,
      incorrect: row.incorrect,
      forcedUnlocks: row.forcedUnlocks,
      averageAiScore: row.averageAiScore,
      sessionDurationMs: row.sessionDurationMs,
      savedAt:
        row.savedAt instanceof Date ? row.savedAt : new Date(row.savedAt),
      perCard: row.perCard ?? null,
    })),
  );
}

export async function deleteAiRecallDataForUser(userId: string): Promise<void> {
  await db.delete(aiRecallSessions).where(eq(aiRecallSessions.userId, userId));
  await db.delete(cardMastery).where(eq(cardMastery.userId, userId));
}

/** Aggregate session analytics from per-card snapshots (pure helper for actions/tests). */
export function computeSessionAnalytics(input: {
  perCard: AiRecallPerCardSnapshot[];
  sessionDurationMs: number;
  masteredCards: number;
  needsReview: number;
}): AiRecallSessionAnalytics {
  const cardsReviewed = input.perCard.length;
  const correct = input.perCard.filter((c) => c.outcome === "correct").length;
  const incorrect = input.perCard.filter(
    (c) => c.outcome === "incorrect",
  ).length;
  const forcedUnlocks = input.perCard.filter(
    (c) => c.outcome === "forced_unlock",
  ).length;
  const times = input.perCard.map((c) => c.recallTimeMs);
  const averageRecallTimeMs =
    times.length > 0
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      : 0;
  const scores = input.perCard
    .map((c) => c.score)
    .filter((s): s is number => s != null);
  const averageAiScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;

  return {
    cardsReviewed,
    correct,
    incorrect,
    forcedUnlocks,
    averageRecallTimeMs,
    averageAiScore,
    masteredCards: input.masteredCards,
    needsReview: input.needsReview,
    sessionDurationMs: input.sessionDurationMs,
  };
}

export async function getDeckSubjectContext(deckId: number): Promise<{
  name: string;
  description: string | null;
  difficultyLevel: string | null;
} | null> {
  const [row] = await db
    .select({
      name: decks.name,
      description: decks.description,
      difficultyLevel: decks.difficultyLevel,
    })
    .from(decks)
    .where(eq(decks.id, deckId))
    .limit(1);
  return row ?? null;
}

export {
  AI_RECALL_SESSION_CARD_COUNT_ALL,
  AI_RECALL_SESSION_CARD_COUNT_MAX,
  AI_RECALL_SESSION_CARD_COUNT_MIN,
  clampAiRecallSessionCardCount,
  resolveEffectiveAiRecallSessionCardCount,
  type AiRecallSessionCardDeckSnapshot,
} from "@/lib/ai-recall-session-cards";

export async function deliverAiRecallSessionInbox(input: {
  sessionId: number;
  recipientUserId: string;
  deckName: string;
  correct: number;
  cardsReviewed: number;
  averageAiScore: number | null;
}): Promise<void> {
  const percent =
    input.cardsReviewed > 0
      ? Math.round((input.correct / input.cardsReviewed) * 100)
      : 0;
  const scorePart =
    input.averageAiScore != null
      ? ` · AI score ${input.averageAiScore}%`
      : "";
  const title = `AI Recall™ — ${input.deckName}`;
  const description = `${percent}% correct (${input.correct}/${input.cardsReviewed})${scorePart}`;

  await db
    .insert(aiRecallResultInboxMessages)
    .values({
      recipientUserId: input.recipientUserId,
      sessionId: input.sessionId,
      title,
      description,
    })
    .onConflictDoNothing({
      target: [
        aiRecallResultInboxMessages.recipientUserId,
        aiRecallResultInboxMessages.sessionId,
      ],
    });

  notifyNativeInboxPush({
    recipientUserId: input.recipientUserId,
    category: "ai_recall_result",
    body: `${title}: ${description}`,
  });
}

export async function getAiRecallResultInboxForUser(userId: string) {
  return db
    .select({
      id: aiRecallResultInboxMessages.id,
      title: aiRecallResultInboxMessages.title,
      description: aiRecallResultInboxMessages.description,
      read: aiRecallResultInboxMessages.read,
      createdAt: aiRecallResultInboxMessages.createdAt,
      sessionId: aiRecallResultInboxMessages.sessionId,
      deckName: aiRecallSessions.deckName,
      correct: aiRecallSessions.correct,
      incorrect: aiRecallSessions.incorrect,
      cardsReviewed: aiRecallSessions.cardsReviewed,
      averageAiScore: aiRecallSessions.averageAiScore,
      sessionDurationMs: aiRecallSessions.sessionDurationMs,
      teamId: aiRecallSessions.teamId,
    })
    .from(aiRecallResultInboxMessages)
    .innerJoin(
      aiRecallSessions,
      eq(aiRecallResultInboxMessages.sessionId, aiRecallSessions.id),
    )
    .where(eq(aiRecallResultInboxMessages.recipientUserId, userId))
    .orderBy(desc(aiRecallResultInboxMessages.createdAt));
}

export async function markAiRecallResultInboxRead(
  messageId: number,
  recipientUserId: string,
): Promise<void> {
  await db
    .update(aiRecallResultInboxMessages)
    .set({ read: true })
    .where(
      and(
        eq(aiRecallResultInboxMessages.id, messageId),
        eq(aiRecallResultInboxMessages.recipientUserId, recipientUserId),
      ),
    );
}
