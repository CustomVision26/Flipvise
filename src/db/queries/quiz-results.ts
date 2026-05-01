import { db } from "@/db";
import {
  quizResults,
  quizResultInboxMessages,
  teams,
  type PerCardSnapshot,
} from "@/db/schema";
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

/**
 * Persists a quiz result and creates inbox messages:
 * - Always one row for the quiz-taker.
 * - For team-deck quizzes, a second row for the workspace owner when the taker is not the owner.
 */
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

  let ownerUserId: string | null = null;
  let teamName: string | null = null;

  if (input.teamId !== null) {
    const [team] = await db
      .select({ ownerUserId: teams.ownerUserId, name: teams.name })
      .from(teams)
      .where(eq(teams.id, input.teamId));
    if (team) {
      ownerUserId = team.ownerUserId;
      teamName = team.name;
    }
  }

  const inboxRecipients: string[] = [input.userId];
  if (ownerUserId && ownerUserId !== input.userId) {
    inboxRecipients.push(ownerUserId);
  }

  await db.insert(quizResultInboxMessages).values(
    inboxRecipients.map((recipientUserId) => ({
      recipientUserId,
      quizResultId: saved.id,
    })),
  );

  return { result: saved, ownerUserId, teamName };
}

/** Quiz result row if `viewerUserId` is the taker or the team owner (for team results). */
export async function getQuizResultByIdForViewer(
  resultId: number,
  viewerUserId: string,
): Promise<QuizResultRow | null> {
  const [row] = await db.select().from(quizResults).where(eq(quizResults.id, resultId));
  if (!row) return null;
  if (row.userId === viewerUserId) return row;
  if (row.teamId !== null) {
    const [team] = await db
      .select({ ownerUserId: teams.ownerUserId })
      .from(teams)
      .where(eq(teams.id, row.teamId));
    if (team?.ownerUserId === viewerUserId) return row;
  }
  return null;
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
