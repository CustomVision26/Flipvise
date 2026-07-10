import { db } from "@/db";
import {
  quizResults,
  quizResultInboxMessages,
  teams,
  type PerCardSnapshot,
} from "@/db/schema";
import {
  resolveQuizResultInboxRecipients,
  type QuizResultInboxTarget,
} from "@/lib/quiz-result-inbox-targets";
import { listTeamMembers } from "@/db/queries/teams";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
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
  /** Team admin user IDs when `team_admin` was included in inbox targets. */
  teamAdminUserIds: string[];
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
  /** When omitted, the quiz-taker and workspace owner (if any) both receive inbox rows. */
  inboxTargets?: QuizResultInboxTarget[];
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

  let teamAdminUserIds: string[] = [];
  if (input.teamId !== null && input.inboxTargets?.includes("team_admin")) {
    const members = await listTeamMembers(input.teamId);
    teamAdminUserIds = members
      .filter((member) => member.role === "team_admin")
      .map((member) => member.userId);
  }

  const inboxRecipients = resolveQuizResultInboxRecipients(
    input.userId,
    ownerUserId,
    input.inboxTargets,
    teamAdminUserIds,
  );

  if (inboxRecipients.length > 0) {
    await db.insert(quizResultInboxMessages).values(
      inboxRecipients.map((recipientUserId) => ({
        recipientUserId,
        quizResultId: saved.id,
      })),
    );
  }

  return { result: saved, ownerUserId, teamName, teamAdminUserIds };
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

    const [inboxRow] = await db
      .select({ id: quizResultInboxMessages.id })
      .from(quizResultInboxMessages)
      .where(
        and(
          eq(quizResultInboxMessages.quizResultId, resultId),
          eq(quizResultInboxMessages.recipientUserId, viewerUserId),
        ),
      )
      .limit(1);
    if (inboxRow) return row;
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

/** Saved quiz results across multiple team workspaces (subscriber admin view). */
export async function getQuizResultsForTeams(teamIds: number[]): Promise<QuizResultRow[]> {
  if (teamIds.length === 0) return [];
  return db
    .select()
    .from(quizResults)
    .where(inArray(quizResults.teamId, teamIds))
    .orderBy(desc(quizResults.savedAt));
}

/** Deletes a team quiz result when it belongs to the given workspace. */
export async function deleteQuizResultForTeamAdmin(
  resultId: number,
  teamId: number,
): Promise<void> {
  const deleted = await db
    .delete(quizResults)
    .where(and(eq(quizResults.id, resultId), eq(quizResults.teamId, teamId)))
    .returning({ id: quizResults.id });
  if (deleted.length === 0) {
    throw new Error("Quiz result not found");
  }
}

/** Loads a team quiz result when it belongs to the given workspace. */
export async function getQuizResultForTeamAdmin(
  resultId: number,
  teamId: number,
): Promise<QuizResultRow | null> {
  const [row] = await db
    .select()
    .from(quizResults)
    .where(and(eq(quizResults.id, resultId), eq(quizResults.teamId, teamId)))
    .limit(1);
  return row ?? null;
}

export type QuizResultInboxEntry = QuizResultInboxMessageRow & {
  quizResult: QuizResultRow;
};

/**
 * Offline sync historically inserted `quiz_results` without inbox rows. Create any
 * missing inbox messages for results this user should see (taker or team owner).
 */
async function backfillMissingQuizResultInboxMessages(
  recipientUserId: string,
): Promise<void> {
  const asTaker = await db
    .select({ id: quizResults.id })
    .from(quizResults)
    .leftJoin(
      quizResultInboxMessages,
      and(
        eq(quizResultInboxMessages.quizResultId, quizResults.id),
        eq(quizResultInboxMessages.recipientUserId, recipientUserId),
      ),
    )
    .where(and(eq(quizResults.userId, recipientUserId), isNull(quizResultInboxMessages.id)));

  const asOwner = await db
    .select({ id: quizResults.id })
    .from(quizResults)
    .innerJoin(teams, eq(quizResults.teamId, teams.id))
    .leftJoin(
      quizResultInboxMessages,
      and(
        eq(quizResultInboxMessages.quizResultId, quizResults.id),
        eq(quizResultInboxMessages.recipientUserId, recipientUserId),
      ),
    )
    .where(
      and(
        eq(teams.ownerUserId, recipientUserId),
        isNull(quizResultInboxMessages.id),
      ),
    );

  const quizResultIds = [
    ...new Set([...asTaker, ...asOwner].map((r) => r.id)),
  ];
  if (quizResultIds.length === 0) return;

  await db.insert(quizResultInboxMessages).values(
    quizResultIds.map((quizResultId) => ({
      recipientUserId,
      quizResultId,
    })),
  );
}

/** Inbox messages addressed to a recipient, joined with the full result row. */
export async function getQuizResultInboxForUser(
  recipientUserId: string,
): Promise<QuizResultInboxEntry[]> {
  await backfillMissingQuizResultInboxMessages(recipientUserId);

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
