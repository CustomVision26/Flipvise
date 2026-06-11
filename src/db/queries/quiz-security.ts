import { db } from "@/db";
import {
  quizSecurityInboxMessages,
  quizSecuritySessions,
  teams,
  type QuizSecuritySessionState,
} from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type QuizSecuritySessionRow = InferSelectModel<typeof quizSecuritySessions>;
export type QuizSecurityInboxMessageRow = InferSelectModel<typeof quizSecurityInboxMessages>;

export type QuizSecurityWorkspaceSnapshot = {
  id: number;
  name: string;
  quizSecurityEnabled: boolean;
};

export type QuizSecuritySessionAdminRow = QuizSecuritySessionRow & {
  teamName: string;
};

export type QuizSecurityInboxEntry = QuizSecurityInboxMessageRow & {
  session: QuizSecuritySessionRow;
  teamName: string | null;
  ownerUserId: string | null;
};

const ADMIN_VISIBLE_STATUSES = [
  "locked",
  "granted_resume",
  "terminated",
  "completed",
] as const;

export async function listQuizSecurityWorkspaceSnapshots(
  manageableTeams: InferSelectModel<typeof teams>[],
): Promise<QuizSecurityWorkspaceSnapshot[]> {
  return manageableTeams
    .map((team) => ({
      id: team.id,
      name: team.name,
      quizSecurityEnabled: Boolean(team.quizSecurityEnabled),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function isTeamQuizSecurityEnabled(teamId: number): Promise<boolean> {
  const [team] = await db
    .select({ quizSecurityEnabled: teams.quizSecurityEnabled })
    .from(teams)
    .where(eq(teams.id, teamId));
  return Boolean(team?.quizSecurityEnabled);
}

export async function updateTeamQuizSecurityEnabled(
  teamId: number,
  enabled: boolean,
): Promise<void> {
  await db
    .update(teams)
    .set({ quizSecurityEnabled: enabled })
    .where(eq(teams.id, teamId));
}

export type QuizSecurityStudyContext = {
  enabled: boolean;
  teamId: number;
  initialSession: {
    id: number;
    status: QuizSecuritySessionRow["status"];
    sessionState: QuizSecuritySessionState | null;
  } | null;
};

export async function resolveQuizSecurityContextForStudy(
  userId: string,
  deckId: number,
  teamId: number,
): Promise<QuizSecurityStudyContext | null> {
  const securityEnabled = await isTeamQuizSecurityEnabled(teamId);
  if (!securityEnabled) return null;

  const session = await getLatestQuizSecuritySessionForUserDeck(userId, teamId, deckId);
  return {
    enabled: true,
    teamId,
    initialSession: session
      ? {
          id: session.id,
          status: session.status,
          sessionState: session.sessionState ?? null,
        }
      : null,
  };
}

export async function getLatestQuizSecuritySessionForUserDeck(
  userId: string,
  teamId: number,
  deckId: number,
): Promise<QuizSecuritySessionRow | null> {
  const [row] = await db
    .select()
    .from(quizSecuritySessions)
    .where(
      and(
        eq(quizSecuritySessions.userId, userId),
        eq(quizSecuritySessions.teamId, teamId),
        eq(quizSecuritySessions.deckId, deckId),
      ),
    )
    .orderBy(desc(quizSecuritySessions.createdAt))
    .limit(1);
  return row ?? null;
}

export async function createQuizSecuritySession(input: {
  userId: string;
  teamId: number;
  deckId: number;
  deckName: string;
  sessionState: QuizSecuritySessionState;
}): Promise<QuizSecuritySessionRow> {
  const [row] = await db
    .insert(quizSecuritySessions)
    .values({
      userId: input.userId,
      teamId: input.teamId,
      deckId: input.deckId,
      deckName: input.deckName,
      status: "active",
      sessionState: input.sessionState,
      updatedAt: new Date(),
    })
    .returning();
  return row;
}

export async function updateQuizSecuritySession(
  sessionId: number,
  userId: string,
  patch: {
    status?: QuizSecuritySessionRow["status"];
    sessionState?: QuizSecuritySessionState | null;
    lockedAt?: Date | null;
    terminatedAt?: Date | null;
    completedAt?: Date | null;
  },
): Promise<QuizSecuritySessionRow | null> {
  const [row] = await db
    .update(quizSecuritySessions)
    .set({
      ...patch,
      updatedAt: new Date(),
    })
    .where(and(eq(quizSecuritySessions.id, sessionId), eq(quizSecuritySessions.userId, userId)))
    .returning();
  return row ?? null;
}

export async function getQuizSecuritySessionById(
  sessionId: number,
): Promise<QuizSecuritySessionRow | null> {
  const [row] = await db
    .select()
    .from(quizSecuritySessions)
    .where(eq(quizSecuritySessions.id, sessionId));
  return row ?? null;
}

export async function listQuizSecuritySessionsForTeamAdmin(
  teamId: number,
): Promise<QuizSecuritySessionAdminRow[]> {
  const rows = await db
    .select({
      session: quizSecuritySessions,
      teamName: teams.name,
    })
    .from(quizSecuritySessions)
    .innerJoin(teams, eq(quizSecuritySessions.teamId, teams.id))
    .where(
      and(
        eq(quizSecuritySessions.teamId, teamId),
        inArray(quizSecuritySessions.status, [...ADMIN_VISIBLE_STATUSES]),
      ),
    )
    .orderBy(
      desc(quizSecuritySessions.terminatedAt),
      desc(quizSecuritySessions.completedAt),
      desc(quizSecuritySessions.lockedAt),
      desc(quizSecuritySessions.updatedAt),
    );

  return rows.map((r) => ({ ...r.session, teamName: r.teamName }));
}

export async function grantQuizSecuritySessionResume(
  sessionId: number,
  teamId: number,
): Promise<QuizSecuritySessionRow | null> {
  const [row] = await db
    .update(quizSecuritySessions)
    .set({ status: "granted_resume", updatedAt: new Date() })
    .where(
      and(
        eq(quizSecuritySessions.id, sessionId),
        eq(quizSecuritySessions.teamId, teamId),
        eq(quizSecuritySessions.status, "locked"),
      ),
    )
    .returning();
  return row ?? null;
}

/** Lets a terminated or completed member start a fresh secured quiz. */
export async function grantQuizSecuritySessionRestart(
  sessionId: number,
  teamId: number,
): Promise<QuizSecuritySessionRow | null> {
  const [row] = await db
    .update(quizSecuritySessions)
    .set({
      status: "granted_resume",
      sessionState: null,
      lockedAt: null,
      terminatedAt: null,
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(quizSecuritySessions.id, sessionId),
        eq(quizSecuritySessions.teamId, teamId),
        inArray(quizSecuritySessions.status, ["terminated", "completed"]),
      ),
    )
    .returning();
  return row ?? null;
}

/** When quiz security is turned off, remove in-progress blocks for that workspace. */
export async function clearQuizSecuritySessionsOnDisable(teamId: number): Promise<void> {
  await db
    .delete(quizSecuritySessions)
    .where(
      and(
        eq(quizSecuritySessions.teamId, teamId),
        inArray(quizSecuritySessions.status, [
          "active",
          "locked",
          "granted_resume",
          "terminated",
          "completed",
        ]),
      ),
    );
}

export async function terminateQuizSecuritySession(
  sessionId: number,
  teamId: number,
): Promise<{ session: QuizSecuritySessionRow; ownerUserId: string } | null> {
  const [team] = await db
    .select({ ownerUserId: teams.ownerUserId })
    .from(teams)
    .where(eq(teams.id, teamId));
  if (!team) return null;

  const [session] = await db
    .update(quizSecuritySessions)
    .set({
      status: "terminated",
      terminatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(quizSecuritySessions.id, sessionId),
        eq(quizSecuritySessions.teamId, teamId),
        inArray(quizSecuritySessions.status, ["locked", "granted_resume", "active"]),
      ),
    )
    .returning();

  if (!session) return null;

  const recipients = new Set<string>([session.userId]);
  if (team.ownerUserId !== session.userId) {
    recipients.add(team.ownerUserId);
  }

  await db.insert(quizSecurityInboxMessages).values(
    [...recipients].map((recipientUserId) => ({
      recipientUserId,
      sessionId: session.id,
    })),
  );

  return { session, ownerUserId: team.ownerUserId };
}

export async function getQuizSecurityInboxForUser(
  recipientUserId: string,
): Promise<QuizSecurityInboxEntry[]> {
  const rows = await db
    .select({
      msg: quizSecurityInboxMessages,
      session: quizSecuritySessions,
      teamName: teams.name,
      ownerUserId: teams.ownerUserId,
    })
    .from(quizSecurityInboxMessages)
    .innerJoin(
      quizSecuritySessions,
      eq(quizSecurityInboxMessages.sessionId, quizSecuritySessions.id),
    )
    .leftJoin(teams, eq(quizSecuritySessions.teamId, teams.id))
    .where(eq(quizSecurityInboxMessages.recipientUserId, recipientUserId))
    .orderBy(desc(quizSecurityInboxMessages.createdAt));

  return rows.map((r) => ({
    ...r.msg,
    session: r.session,
    teamName: r.teamName,
    ownerUserId: r.ownerUserId,
  }));
}

export async function markQuizSecurityInboxRead(
  id: number,
  recipientUserId: string,
): Promise<void> {
  await db
    .update(quizSecurityInboxMessages)
    .set({ read: true })
    .where(
      and(
        eq(quizSecurityInboxMessages.id, id),
        eq(quizSecurityInboxMessages.recipientUserId, recipientUserId),
      ),
    );
}
