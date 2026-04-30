import { db } from "@/db";
import { quizResults, quizResultInboxMessages, teams, type PerCardSnapshot } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type QuizResultRow = InferSelectModel<typeof quizResults>;
export type QuizResultInboxMessageRow = InferSelectModel<typeof quizResultInboxMessages>;
export type { PerCardSnapshot };

export type SaveQuizResultOutput = {
  result: QuizResultRow;
  /** The team owner's Clerk userId when this was a team-deck quiz; null for personal quizzes. */
  ownerUserId: string | null;
  /** Team workspace name when this was a team-deck quiz; null for personal quizzes. */
  teamName: string | null;
};

export type SaveQuizResultInput = {
  userId: string;
  deckId: number | null;
  deckName: string;
  teamId: number | null;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  percent: number;
  elapsedSeconds: number;
  perCard: PerCardSnapshot[];
};

/** Persists a quiz result and creates one inbox message for the appropriate recipient. */
export async function saveQuizResult(input: SaveQuizResultInput): Promise<SaveQuizResultOutput> {
  const [saved] = await db
    .insert(quizResults)
    .values({
      userId: input.userId,
      deckId: input.deckId,
      deckName: input.deckName,
      teamId: input.teamId,
      correct: input.correct,
      incorrect: input.incorrect,
      unanswered: input.unanswered,
      total: input.total,
      percent: input.percent,
      elapsedSeconds: input.elapsedSeconds,
      perCard: input.perCard,
    })
    .returning();

  let recipientUserId = input.userId;
  let ownerUserId: string | null = null;
  let teamName: string | null = null;

  if (input.teamId !== null) {
    const [team] = await db
      .select({ ownerUserId: teams.ownerUserId, name: teams.name })
      .from(teams)
      .where(eq(teams.id, input.teamId));
    if (team) {
      recipientUserId = team.ownerUserId;
      ownerUserId = team.ownerUserId;
      teamName = team.name;
    }
  }

  await db.insert(quizResultInboxMessages).values({
    recipientUserId,
    quizResultId: saved.id,
  });

  return { result: saved, ownerUserId, teamName };
}

/** All saved quiz results for a given user (their own history). */
export async function getQuizResultsForUser(userId: string): Promise<QuizResultRow[]> {
  return db
    .select()
    .from(quizResults)
    .where(eq(quizResults.userId, userId))
    .orderBy(desc(quizResults.savedAt));
}

/** All saved quiz results that belong to a specific team (for the admin view). */
export async function getQuizResultsForTeam(teamId: number): Promise<QuizResultRow[]> {
  return db
    .select()
    .from(quizResults)
    .where(eq(quizResults.teamId, teamId))
    .orderBy(desc(quizResults.savedAt));
}

export type QuizResultInboxEntry = QuizResultInboxMessageRow & {
  quizResult: QuizResultRow;
};

/** Inbox messages addressed to a recipient, joined with the full result row. */
export async function getQuizResultInboxForUser(
  recipientUserId: string,
): Promise<QuizResultInboxEntry[]> {
  const rows = await db
    .select({
      msg: quizResultInboxMessages,
      result: quizResults,
    })
    .from(quizResultInboxMessages)
    .innerJoin(quizResults, eq(quizResultInboxMessages.quizResultId, quizResults.id))
    .where(eq(quizResultInboxMessages.recipientUserId, recipientUserId))
    .orderBy(desc(quizResultInboxMessages.createdAt));

  return rows.map((r) => ({ ...r.msg, quizResult: r.result }));
}

/** Mark an inbox message as read. Only updates if the row belongs to the given recipient. */
export async function markQuizResultInboxRead(
  id: number,
  recipientUserId: string,
): Promise<void> {
  await db
    .update(quizResultInboxMessages)
    .set({ read: true })
    .where(
      and(
        eq(quizResultInboxMessages.id, id),
        eq(quizResultInboxMessages.recipientUserId, recipientUserId),
      ),
    );
}
