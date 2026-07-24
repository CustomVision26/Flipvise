import { db } from "@/db";
import {
  decks,
  quizSecurityInboxMessages,
  quizSecuritySessions,
  teams,
  type QuizSecuritySessionState,
} from "@/db/schema";
import { getDecksForTeam, getMemberRecord, getTeamById } from "@/db/queries/teams";
import {
  quizSecurityAppliesToViewer,
  resolveQuizSecurityAudience,
  resolveQuizSecurityEnabled,
  type QuizSecurityViewerRole,
} from "@/lib/quiz-security-resolve";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type QuizSecuritySessionRow = InferSelectModel<typeof quizSecuritySessions>;
export type QuizSecurityInboxMessageRow = InferSelectModel<typeof quizSecurityInboxMessages>;

export type QuizSecurityWorkspaceSnapshot = {
  id: number;
  name: string;
  quizSecurityEnabled: boolean;
  quizSecurityApplyToMembers: boolean;
  quizSecurityApplyToTeamAdmins: boolean;
};

export type QuizSecurityDeckSnapshot = {
  id: number;
  name: string;
  /** null = inherit workspace quiz security setting */
  quizSecurityEnabled: boolean | null;
  /** null = inherit workspace audience setting */
  quizSecurityApplyToMembers: boolean | null;
  /** null = inherit workspace audience setting */
  quizSecurityApplyToTeamAdmins: boolean | null;
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
      quizSecurityApplyToMembers: team.quizSecurityApplyToMembers !== false,
      quizSecurityApplyToTeamAdmins: Boolean(team.quizSecurityApplyToTeamAdmins),
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

export async function isDeckQuizSecurityEnabled(
  teamId: number,
  deckId: number,
): Promise<boolean> {
  const [team] = await db
    .select({
      quizSecurityEnabled: teams.quizSecurityEnabled,
      quizSecurityApplyToMembers: teams.quizSecurityApplyToMembers,
      quizSecurityApplyToTeamAdmins: teams.quizSecurityApplyToTeamAdmins,
    })
    .from(teams)
    .where(eq(teams.id, teamId));
  if (!team) return false;

  const [deck] = await db
    .select({
      quizSecurityEnabled: decks.quizSecurityEnabled,
      quizSecurityApplyToMembers: decks.quizSecurityApplyToMembers,
      quizSecurityApplyToTeamAdmins: decks.quizSecurityApplyToTeamAdmins,
    })
    .from(decks)
    .where(eq(decks.id, deckId));
  if (!deck) return Boolean(team.quizSecurityEnabled);

  return resolveQuizSecurityEnabled(deck, team);
}

async function resolveQuizSecurityViewerRole(
  userId: string,
  teamId: number,
): Promise<QuizSecurityViewerRole | null> {
  const team = await getTeamById(teamId);
  if (!team) return null;
  if (team.ownerUserId === userId) return "owner";
  const member = await getMemberRecord(teamId, userId);
  if (member?.role === "team_admin") return "team_admin";
  if (member?.role === "team_member") return "team_member";
  return null;
}

/** True when security is on for the deck and applies to this viewer (owner always when on). */
export async function isQuizSecurityActiveForViewer(
  userId: string,
  teamId: number,
  deckId: number,
): Promise<boolean> {
  const [team] = await db
    .select({
      quizSecurityEnabled: teams.quizSecurityEnabled,
      quizSecurityApplyToMembers: teams.quizSecurityApplyToMembers,
      quizSecurityApplyToTeamAdmins: teams.quizSecurityApplyToTeamAdmins,
    })
    .from(teams)
    .where(eq(teams.id, teamId));
  if (!team) return false;

  const [deck] = await db
    .select({
      quizSecurityEnabled: decks.quizSecurityEnabled,
      quizSecurityApplyToMembers: decks.quizSecurityApplyToMembers,
      quizSecurityApplyToTeamAdmins: decks.quizSecurityApplyToTeamAdmins,
    })
    .from(decks)
    .where(eq(decks.id, deckId));

  const enabled = deck
    ? resolveQuizSecurityEnabled(deck, team)
    : Boolean(team.quizSecurityEnabled);
  if (!enabled) return false;

  const viewerRole = await resolveQuizSecurityViewerRole(userId, teamId);
  if (!viewerRole) return false;

  const audience = resolveQuizSecurityAudience(
    deck ?? {
      quizSecurityApplyToMembers: null,
      quizSecurityApplyToTeamAdmins: null,
    },
    {
      quizSecurityApplyToMembers: team.quizSecurityApplyToMembers !== false,
      quizSecurityApplyToTeamAdmins: Boolean(team.quizSecurityApplyToTeamAdmins),
    },
  );

  return quizSecurityAppliesToViewer(viewerRole, audience);
}

export async function listQuizSecurityDeckSnapshots(
  teamId: number,
  ownerUserId: string,
): Promise<QuizSecurityDeckSnapshot[]> {
  const teamDecks = await getDecksForTeam(teamId, ownerUserId);
  const deckIds = teamDecks.map((deck) => deck.id);
  if (deckIds.length === 0) return [];

  const rows = await db
    .select({
      id: decks.id,
      name: decks.name,
      quizSecurityEnabled: decks.quizSecurityEnabled,
      quizSecurityApplyToMembers: decks.quizSecurityApplyToMembers,
      quizSecurityApplyToTeamAdmins: decks.quizSecurityApplyToTeamAdmins,
    })
    .from(decks)
    .where(eq(decks.userId, ownerUserId));

  const deckIdSet = new Set(deckIds);
  return rows
    .filter((row) => deckIdSet.has(row.id))
    .map((row) => ({
      id: row.id,
      name: row.name,
      quizSecurityEnabled: row.quizSecurityEnabled ?? null,
      quizSecurityApplyToMembers: row.quizSecurityApplyToMembers ?? null,
      quizSecurityApplyToTeamAdmins: row.quizSecurityApplyToTeamAdmins ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function updateDeckQuizSecuritySettings(
  deckId: number,
  ownerUserId: string,
  settings: {
    enabled: boolean | null;
    applyToMembers: boolean | null;
    applyToTeamAdmins: boolean | null;
  },
): Promise<void> {
  await db
    .update(decks)
    .set({
      quizSecurityEnabled: settings.enabled,
      quizSecurityApplyToMembers: settings.applyToMembers,
      quizSecurityApplyToTeamAdmins: settings.applyToTeamAdmins,
      updatedAt: new Date(),
    })
    .where(and(eq(decks.id, deckId), eq(decks.userId, ownerUserId)));
}

export async function assertDeckInWorkspaceForSecurity(
  teamId: number,
  ownerUserId: string,
  deckId: number,
): Promise<void> {
  const teamDecks = await getDecksForTeam(teamId, ownerUserId);
  if (!teamDecks.some((deck) => deck.id === deckId)) {
    throw new Error("Deck is not part of this workspace.");
  }
}

/** Drop only in-flight sessions when deck security is turned off; keep admin-actionable history. */
export async function clearQuizSecuritySessionsOnDeckDisable(
  teamId: number,
  deckId: number,
): Promise<void> {
  await db
    .delete(quizSecuritySessions)
    .where(
      and(
        eq(quizSecuritySessions.teamId, teamId),
        eq(quizSecuritySessions.deckId, deckId),
        eq(quizSecuritySessions.status, "active"),
      ),
    );
}

export async function updateTeamQuizSecuritySettings(
  teamId: number,
  settings: {
    enabled: boolean;
    applyToMembers: boolean;
    applyToTeamAdmins: boolean;
  },
): Promise<void> {
  await db
    .update(teams)
    .set({
      quizSecurityEnabled: settings.enabled,
      quizSecurityApplyToMembers: settings.applyToMembers,
      quizSecurityApplyToTeamAdmins: settings.applyToTeamAdmins,
    })
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
  const securityEnabled = await isQuizSecurityActiveForViewer(userId, teamId, deckId);
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

/** Drop only in-flight sessions when workspace security is turned off; keep admin-actionable history. */
export async function clearQuizSecuritySessionsOnDisable(teamId: number): Promise<void> {
  await db
    .delete(quizSecuritySessions)
    .where(
      and(eq(quizSecuritySessions.teamId, teamId), eq(quizSecuritySessions.status, "active")),
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
