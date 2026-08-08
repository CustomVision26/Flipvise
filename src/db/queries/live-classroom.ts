import { randomBytes } from "crypto";
import { db } from "@/db";
import {
  cards,
  decks,
  liveBattleAnswers,
  liveBattleQuestions,
  liveBattleReports,
  liveBattleStrategyCards,
  liveClassroomParticipants,
  liveClassroomSavedGroups,
  liveClassroomSessions,
  liveClassroomParticipantGrants,
  liveClassroomTeacherGrants,
  liveClassroomTeamSettings,
  liveClassroomTeams,
  liveOrganizationAnalytics,
  liveTeacherAnalytics,
  type LiveBattleAnswerRow,
  type LiveBattleQuestionRow,
  type LiveBattleReportRow,
  type LiveBattleStrategyCardRow,
  type LiveClassroomParticipantGrantRow,
  type LiveClassroomParticipantRow,
  type LiveClassroomSavedGroupRow,
  type LiveClassroomSessionRow,
  type LiveClassroomTeacherGrantRow,
  type LiveClassroomTeamRow,
  type LiveClassroomTeamSettingsRow,
  type LiveOrganizationAnalyticsRow,
  type LiveTeacherAnalyticsRow,
} from "@/db/schema";
import {
  LIVE_CLASSROOM_PRESENCE_STALE_MS,
  LIVE_CLASSROOM_DEFAULT_TEAM_NAMES,
  type LiveClassroomBattleMode,
  type LiveClassroomReportStats,
  type LiveClassroomSessionConfig,
  type LiveClassroomSessionStatus,
  type LiveClassroomSessionType,
  type LiveClassroomStrategyCardKind,
  type LiveClassroomStrategyCardPolicy,
  type LiveClassroomTeamAssignmentMode,
} from "@/lib/live-classroom-types";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";

export type {
  LiveBattleAnswerRow,
  LiveBattleQuestionRow,
  LiveBattleReportRow,
  LiveBattleStrategyCardRow,
  LiveClassroomParticipantGrantRow,
  LiveClassroomParticipantRow,
  LiveClassroomSavedGroupRow,
  LiveClassroomSessionRow,
  LiveClassroomTeacherGrantRow,
  LiveClassroomTeamRow,
  LiveClassroomTeamSettingsRow,
  LiveOrganizationAnalyticsRow,
  LiveTeacherAnalyticsRow,
};

const ACTIVE_OR_LOBBY_STATUSES = ["lobby", "active", "paused"] as const;

const JOIN_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function startOfUtcDay(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function endOfUtcDay(date = new Date()): Date {
  const start = startOfUtcDay(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export async function getOrCreateLiveClassroomTeamSettings(
  teamId: number,
): Promise<LiveClassroomTeamSettingsRow> {
  const [existing] = await db
    .select()
    .from(liveClassroomTeamSettings)
    .where(eq(liveClassroomTeamSettings.teamId, teamId))
    .limit(1);
  if (existing) return existing;

  await db
    .insert(liveClassroomTeamSettings)
    .values({ teamId })
    .onConflictDoNothing({ target: liveClassroomTeamSettings.teamId });

  const [row] = await db
    .select()
    .from(liveClassroomTeamSettings)
    .where(eq(liveClassroomTeamSettings.teamId, teamId))
    .limit(1);
  if (!row) {
    throw new Error(
      `Failed to initialize live_classroom_team_settings for team ${teamId}`,
    );
  }
  return row;
}

export async function updateLiveClassroomTeamSettings(
  teamId: number,
  patch: Partial<{
    enabled: boolean;
    defaultBattleType: LiveClassroomSessionType;
    allowMusic: boolean;
    allowStrategyCards: boolean;
    allowAiExplanations: boolean;
    defaultTeamAssignment: LiveClassroomTeamAssignmentMode;
    maxConcurrentSessions: number;
    strategyCardPolicy: LiveClassroomStrategyCardPolicy;
    strategyCardLimitPerTeam: number;
  }>,
): Promise<LiveClassroomTeamSettingsRow | null> {
  const [row] = await db
    .update(liveClassroomTeamSettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(liveClassroomTeamSettings.teamId, teamId))
    .returning();
  return row ?? null;
}

export async function getLiveClassroomTeacherGrant(
  teamId: number,
  userId: string,
): Promise<LiveClassroomTeacherGrantRow | null> {
  const [row] = await db
    .select()
    .from(liveClassroomTeacherGrants)
    .where(
      and(
        eq(liveClassroomTeacherGrants.teamId, teamId),
        eq(liveClassroomTeacherGrants.userId, userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listLiveClassroomTeacherGrants(
  teamId: number,
): Promise<LiveClassroomTeacherGrantRow[]> {
  return db
    .select()
    .from(liveClassroomTeacherGrants)
    .where(eq(liveClassroomTeacherGrants.teamId, teamId))
    .orderBy(desc(liveClassroomTeacherGrants.createdAt));
}

export async function grantLiveClassroomTeacher(
  teamId: number,
  userId: string,
  grantedByUserId: string,
): Promise<LiveClassroomTeacherGrantRow> {
  const [inserted] = await db
    .insert(liveClassroomTeacherGrants)
    .values({ teamId, userId, grantedByUserId })
    .onConflictDoNothing({
      target: [
        liveClassroomTeacherGrants.teamId,
        liveClassroomTeacherGrants.userId,
      ],
    })
    .returning();
  if (inserted) return inserted;

  const existing = await getLiveClassroomTeacherGrant(teamId, userId);
  if (!existing) {
    throw new Error(
      `Failed to grant Live Classroom teacher for team ${teamId}`,
    );
  }
  return existing;
}

export async function revokeLiveClassroomTeacher(
  teamId: number,
  userId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(liveClassroomTeacherGrants)
    .where(
      and(
        eq(liveClassroomTeacherGrants.teamId, teamId),
        eq(liveClassroomTeacherGrants.userId, userId),
      ),
    )
    .returning({ id: liveClassroomTeacherGrants.id });
  return deleted.length > 0;
}

export async function getLiveClassroomParticipantGrant(
  teamId: number,
  userId: string,
): Promise<LiveClassroomParticipantGrantRow | null> {
  const [row] = await db
    .select()
    .from(liveClassroomParticipantGrants)
    .where(
      and(
        eq(liveClassroomParticipantGrants.teamId, teamId),
        eq(liveClassroomParticipantGrants.userId, userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listLiveClassroomParticipantGrants(
  teamId: number,
): Promise<LiveClassroomParticipantGrantRow[]> {
  return db
    .select()
    .from(liveClassroomParticipantGrants)
    .where(eq(liveClassroomParticipantGrants.teamId, teamId))
    .orderBy(desc(liveClassroomParticipantGrants.createdAt));
}

export async function grantLiveClassroomParticipant(
  teamId: number,
  userId: string,
  grantedByUserId: string,
): Promise<LiveClassroomParticipantGrantRow> {
  const [inserted] = await db
    .insert(liveClassroomParticipantGrants)
    .values({ teamId, userId, grantedByUserId })
    .onConflictDoNothing({
      target: [
        liveClassroomParticipantGrants.teamId,
        liveClassroomParticipantGrants.userId,
      ],
    })
    .returning();
  if (inserted) return inserted;

  const existing = await getLiveClassroomParticipantGrant(teamId, userId);
  if (!existing) {
    throw new Error(
      `Failed to grant Live Classroom participant for team ${teamId}`,
    );
  }
  return existing;
}

export async function revokeLiveClassroomParticipant(
  teamId: number,
  userId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(liveClassroomParticipantGrants)
    .where(
      and(
        eq(liveClassroomParticipantGrants.teamId, teamId),
        eq(liveClassroomParticipantGrants.userId, userId),
      ),
    )
    .returning({ id: liveClassroomParticipantGrants.id });
  return deleted.length > 0;
}

export async function listLiveClassroomSavedGroups(
  teamId: number,
): Promise<LiveClassroomSavedGroupRow[]> {
  return db
    .select()
    .from(liveClassroomSavedGroups)
    .where(eq(liveClassroomSavedGroups.teamId, teamId))
    .orderBy(desc(liveClassroomSavedGroups.updatedAt));
}

export async function createLiveClassroomSavedGroup(input: {
  teamId: number;
  name: string;
  groups: Array<{ teamName: string; userIds: string[] }>;
  createdByUserId: string;
}): Promise<LiveClassroomSavedGroupRow> {
  const now = new Date();
  const [row] = await db
    .insert(liveClassroomSavedGroups)
    .values({
      teamId: input.teamId,
      name: input.name,
      groups: input.groups,
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) throw new Error("Failed to create live classroom saved group");
  return row;
}

export async function getLiveClassroomSavedGroup(
  id: number,
): Promise<LiveClassroomSavedGroupRow | null> {
  const [row] = await db
    .select()
    .from(liveClassroomSavedGroups)
    .where(eq(liveClassroomSavedGroups.id, id))
    .limit(1);
  return row ?? null;
}

export async function updateLiveClassroomSavedGroup(
  id: number,
  patch: Partial<{
    name: string;
    groups: Array<{ teamName: string; userIds: string[] }>;
  }>,
): Promise<LiveClassroomSavedGroupRow | null> {
  const [row] = await db
    .update(liveClassroomSavedGroups)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(liveClassroomSavedGroups.id, id))
    .returning();
  return row ?? null;
}

export async function deleteLiveClassroomSavedGroup(
  id: number,
): Promise<boolean> {
  const deleted = await db
    .delete(liveClassroomSavedGroups)
    .where(eq(liveClassroomSavedGroups.id, id))
    .returning({ id: liveClassroomSavedGroups.id });
  return deleted.length > 0;
}

export function generateLiveClassroomJoinCode(): string {
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += JOIN_CODE_ALPHABET[bytes[i]! % JOIN_CODE_ALPHABET.length]!;
  }
  return code;
}

async function generateUniqueJoinCode(maxAttempts = 8): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateLiveClassroomJoinCode();
    const existing = await getLiveClassroomSessionByJoinCode(code);
    if (!existing) return code;
  }
  throw new Error("Failed to generate a unique Live Classroom join code");
}

export async function createLiveClassroomSession(input: {
  teamId: number;
  hostUserId: string;
  name: string;
  config: LiveClassroomSessionConfig;
  status?: LiveClassroomSessionStatus;
  sessionType?: LiveClassroomSessionType;
  battleMode?: LiveClassroomBattleMode;
  deckId?: number | null;
  savedGroupId?: number | null;
  scheduledFor?: Date | null;
  joinCode?: string;
  extensions?: Record<string, unknown>;
}): Promise<LiveClassroomSessionRow> {
  const now = new Date();
  const joinCode = input.joinCode ?? (await generateUniqueJoinCode());
  const [row] = await db
    .insert(liveClassroomSessions)
    .values({
      teamId: input.teamId,
      hostUserId: input.hostUserId,
      name: input.name,
      status: input.status ?? "lobby",
      sessionType: input.sessionType ?? "warm_up",
      battleMode: input.battleMode ?? "individual_team",
      deckId: input.deckId ?? null,
      savedGroupId: input.savedGroupId ?? null,
      config: input.config,
      scheduledFor: input.scheduledFor ?? null,
      joinCode,
      extensions: input.extensions ?? {},
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) throw new Error("Failed to create live classroom session");
  return row;
}

export async function getLiveClassroomSessionById(
  id: number,
): Promise<LiveClassroomSessionRow | null> {
  const [row] = await db
    .select()
    .from(liveClassroomSessions)
    .where(eq(liveClassroomSessions.id, id))
    .limit(1);
  return row ?? null;
}

export async function getLiveClassroomSessionByJoinCode(
  code: string,
): Promise<LiveClassroomSessionRow | null> {
  const [row] = await db
    .select()
    .from(liveClassroomSessions)
    .where(eq(liveClassroomSessions.joinCode, code.toUpperCase()))
    .limit(1);
  return row ?? null;
}

export async function listLiveClassroomSessionsForTeam(
  teamId: number,
  options?: {
    status?: LiveClassroomSessionStatus | LiveClassroomSessionStatus[];
    limit?: number;
  },
): Promise<LiveClassroomSessionRow[]> {
  const statuses = options?.status
    ? Array.isArray(options.status)
      ? options.status
      : [options.status]
    : null;

  const conditions = [eq(liveClassroomSessions.teamId, teamId)];
  if (statuses && statuses.length > 0) {
    conditions.push(inArray(liveClassroomSessions.status, statuses));
  }

  const query = db
    .select()
    .from(liveClassroomSessions)
    .where(and(...conditions))
    .orderBy(desc(liveClassroomSessions.createdAt));

  if (options?.limit != null) {
    return query.limit(options.limit);
  }
  return query;
}

/** Deck name + card count for Live Classroom session list rows. */
export async function getLiveClassroomDeckSummariesByIds(
  deckIds: number[],
): Promise<Record<number, { name: string; cardCount: number }>> {
  const unique = [
    ...new Set(
      deckIds.filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
  if (unique.length === 0) return {};

  const rows = await db
    .select({
      id: decks.id,
      name: decks.name,
      cardCount: sql<number>`cast(count(${cards.id}) as integer)`,
    })
    .from(decks)
    .leftJoin(cards, eq(cards.deckId, decks.id))
    .where(inArray(decks.id, unique))
    .groupBy(decks.id, decks.name);

  const out: Record<number, { name: string; cardCount: number }> = {};
  for (const row of rows) {
    out[row.id] = {
      name: row.name,
      cardCount: Number(row.cardCount) || 0,
    };
  }
  return out;
}

/**
 * Per-session lobby readiness for the Sessions Pool list: how many
 * team-assigned (non-removed) participants there are, and how many of those
 * are currently connected + presence-fresh ("ready"). Unassigned members are
 * excluded since they won't join the battle.
 */
export async function getLiveClassroomLobbyReadinessBySessionIds(
  sessionIds: number[],
): Promise<Record<number, { assignedCount: number; readyCount: number }>> {
  const unique = [...new Set(sessionIds.filter((id) => Number.isFinite(id)))];
  const out: Record<number, { assignedCount: number; readyCount: number }> =
    {};
  if (unique.length === 0) return out;

  const rows = await db
    .select({
      sessionId: liveClassroomParticipants.sessionId,
      connected: liveClassroomParticipants.connected,
      lastSeenAt: liveClassroomParticipants.lastSeenAt,
    })
    .from(liveClassroomParticipants)
    .where(
      and(
        inArray(liveClassroomParticipants.sessionId, unique),
        eq(liveClassroomParticipants.removed, false),
        isNotNull(liveClassroomParticipants.liveTeamId),
      ),
    );

  const nowMs = Date.now();
  for (const row of rows) {
    const entry = out[row.sessionId] ?? { assignedCount: 0, readyCount: 0 };
    entry.assignedCount += 1;
    if (
      row.connected &&
      nowMs - row.lastSeenAt.getTime() <= LIVE_CLASSROOM_PRESENCE_STALE_MS
    ) {
      entry.readyCount += 1;
    }
    out[row.sessionId] = entry;
  }
  return out;
}

export async function listActiveOrLobbySessionsForTeam(
  teamId: number,
): Promise<LiveClassroomSessionRow[]> {
  return db
    .select()
    .from(liveClassroomSessions)
    .where(
      and(
        eq(liveClassroomSessions.teamId, teamId),
        inArray(liveClassroomSessions.status, [...ACTIVE_OR_LOBBY_STATUSES]),
      ),
    )
    .orderBy(desc(liveClassroomSessions.updatedAt));
}

/** Another session on the team that is mid-battle (active/paused). */
export async function getOtherLiveBattleSessionForTeam(
  teamId: number,
  excludeSessionId: number,
): Promise<{ id: number; name: string } | null> {
  const [row] = await db
    .select({
      id: liveClassroomSessions.id,
      name: liveClassroomSessions.name,
    })
    .from(liveClassroomSessions)
    .where(
      and(
        eq(liveClassroomSessions.teamId, teamId),
        inArray(liveClassroomSessions.status, ["active", "paused"]),
        ne(liveClassroomSessions.id, excludeSessionId),
      ),
    )
    .orderBy(desc(liveClassroomSessions.updatedAt))
    .limit(1);
  return row ?? null;
}

export async function countConcurrentLiveSessions(
  teamId: number,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(liveClassroomSessions)
    .where(
      and(
        eq(liveClassroomSessions.teamId, teamId),
        inArray(liveClassroomSessions.status, [...ACTIVE_OR_LOBBY_STATUSES]),
      ),
    );
  return row?.value ?? 0;
}

export async function updateLiveClassroomSession(
  id: number,
  patch: Partial<{
    name: string;
    status: LiveClassroomSessionStatus;
    sessionType: LiveClassroomSessionType;
    battleMode: LiveClassroomBattleMode;
    deckId: number | null;
    savedGroupId: number | null;
    config: LiveClassroomSessionConfig;
    currentQuestionIndex: number;
    questionStartedAt: Date | null;
    musicMuted: boolean;
    teamsLocked: boolean;
    scheduledFor: Date | null;
    startedAt: Date | null;
    endedAt: Date | null;
    extensions: Record<string, unknown>;
  }>,
): Promise<LiveClassroomSessionRow | null> {
  const [row] = await db
    .update(liveClassroomSessions)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(liveClassroomSessions.id, id))
    .returning();
  return row ?? null;
}

export async function createLiveClassroomTeamsForSession(
  sessionId: number,
  teams: Array<{
    name: string;
    colorKey: string;
    sortOrder: number;
    hearts: number;
  }>,
): Promise<LiveClassroomTeamRow[]> {
  if (teams.length === 0) return [];
  const now = new Date();
  return db
    .insert(liveClassroomTeams)
    .values(
      teams.map((team) => ({
        sessionId,
        name: team.name,
        colorKey: team.colorKey,
        sortOrder: team.sortOrder,
        hearts: team.hearts,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .returning();
}

export async function listLiveClassroomTeams(
  sessionId: number,
): Promise<LiveClassroomTeamRow[]> {
  return db
    .select()
    .from(liveClassroomTeams)
    .where(eq(liveClassroomTeams.sessionId, sessionId))
    .orderBy(asc(liveClassroomTeams.sortOrder), asc(liveClassroomTeams.id));
}

/**
 * Grow or shrink lobby teams to `teamCount` (2–4). Extra teams are deleted
 * (participants on removed teams become unassigned via FK set null).
 */
export async function resizeLiveClassroomSessionTeams(input: {
  sessionId: number;
  teamCount: number;
  survivalHearts: number;
}): Promise<LiveClassroomTeamRow[]> {
  const target = Math.min(4, Math.max(2, Math.floor(input.teamCount)));
  const existing = await listLiveClassroomTeams(input.sessionId);
  if (existing.length === target) return existing;

  const colorKeys = ["blue", "red", "green", "yellow"] as const;
  const hearts =
    input.survivalHearts > 0 ? input.survivalHearts : 3;

  if (existing.length > target) {
    const removeIds = existing.slice(target).map((t) => t.id);
    if (removeIds.length > 0) {
      await db
        .delete(liveClassroomTeams)
        .where(inArray(liveClassroomTeams.id, removeIds));
    }
    return listLiveClassroomTeams(input.sessionId);
  }

  const start = existing.length;
  await createLiveClassroomTeamsForSession(
    input.sessionId,
    Array.from({ length: target - existing.length }, (_, i) => {
      const index = start + i;
      return {
        name:
          LIVE_CLASSROOM_DEFAULT_TEAM_NAMES[index] ?? `Team ${index + 1}`,
        colorKey: colorKeys[index] ?? "blue",
        sortOrder: index,
        hearts,
      };
    }),
  );
  return listLiveClassroomTeams(input.sessionId);
}

export async function updateLiveClassroomTeam(
  id: number,
  patch: Partial<{
    name: string;
    colorKey: string;
    score: number;
    hearts: number;
    eliminated: boolean;
    captainUserId: string | null;
    sortOrder: number;
  }>,
): Promise<LiveClassroomTeamRow | null> {
  const [row] = await db
    .update(liveClassroomTeams)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(liveClassroomTeams.id, id))
    .returning();
  return row ?? null;
}

export async function upsertLiveClassroomParticipant(input: {
  sessionId: number;
  userId: string;
  displayName?: string;
  connected?: boolean;
  liveTeamId?: number | null;
}): Promise<LiveClassroomParticipantRow> {
  const now = new Date();
  const connected = input.connected ?? true;
  const [row] = await db
    .insert(liveClassroomParticipants)
    .values({
      sessionId: input.sessionId,
      userId: input.userId,
      displayName: input.displayName ?? "",
      liveTeamId: input.liveTeamId ?? null,
      connected,
      lastSeenAt: now,
      joinedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        liveClassroomParticipants.sessionId,
        liveClassroomParticipants.userId,
      ],
      set: {
        connected,
        lastSeenAt: now,
        removed: false,
        updatedAt: now,
        displayName:
          input.displayName !== undefined
            ? input.displayName
            : sql`${liveClassroomParticipants.displayName}`,
        ...(input.liveTeamId !== undefined
          ? { liveTeamId: input.liveTeamId }
          : {}),
      },
    })
    .returning();
  if (!row) throw new Error("Failed to upsert live classroom participant");
  return row;
}

export async function listLiveClassroomParticipants(
  sessionId: number,
  options?: { includeRemoved?: boolean },
): Promise<LiveClassroomParticipantRow[]> {
  const conditions = [eq(liveClassroomParticipants.sessionId, sessionId)];
  if (!options?.includeRemoved) {
    conditions.push(eq(liveClassroomParticipants.removed, false));
  }
  return db
    .select()
    .from(liveClassroomParticipants)
    .where(and(...conditions))
    .orderBy(asc(liveClassroomParticipants.joinedAt));
}

export async function getLiveClassroomParticipant(
  sessionId: number,
  userId: string,
): Promise<LiveClassroomParticipantRow | null> {
  const [row] = await db
    .select()
    .from(liveClassroomParticipants)
    .where(
      and(
        eq(liveClassroomParticipants.sessionId, sessionId),
        eq(liveClassroomParticipants.userId, userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function updateLiveClassroomParticipant(
  id: number,
  patch: Partial<{
    displayName: string;
    liveTeamId: number | null;
    connected: boolean;
    lastSeenAt: Date;
    correctCount: number;
    incorrectCount: number;
    totalResponseTimeMs: number;
    answersSubmitted: number;
    removed: boolean;
  }>,
): Promise<LiveClassroomParticipantRow | null> {
  const [row] = await db
    .update(liveClassroomParticipants)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(liveClassroomParticipants.id, id))
    .returning();
  return row ?? null;
}

/** Clear ghost "Ready" rows after heartbeats stop (user left lobby/play). */
export async function markStaleLiveClassroomParticipantsDisconnected(
  sessionId: number,
  staleMs: number = LIVE_CLASSROOM_PRESENCE_STALE_MS,
): Promise<number> {
  const cutoff = new Date(Date.now() - staleMs);
  const rows = await db
    .update(liveClassroomParticipants)
    .set({ connected: false, updatedAt: new Date() })
    .where(
      and(
        eq(liveClassroomParticipants.sessionId, sessionId),
        eq(liveClassroomParticipants.connected, true),
        eq(liveClassroomParticipants.removed, false),
        lt(liveClassroomParticipants.lastSeenAt, cutoff),
      ),
    )
    .returning({ id: liveClassroomParticipants.id });
  return rows.length;
}

export async function insertLiveBattleQuestions(
  sessionId: number,
  questions: Array<{
    sortOrder: number;
    prompt: string;
    choices: string[];
    correctIndex: number;
    explanation?: string;
    distractorExplanations?: string[];
    topic?: string;
    cardId?: number | null;
    media?: LiveBattleQuestionRow["media"];
  }>,
): Promise<LiveBattleQuestionRow[]> {
  if (questions.length === 0) return [];
  return db
    .insert(liveBattleQuestions)
    .values(
      questions.map((q) => ({
        sessionId,
        sortOrder: q.sortOrder,
        prompt: q.prompt,
        choices: q.choices,
        correctIndex: q.correctIndex,
        explanation: q.explanation ?? "",
        distractorExplanations: q.distractorExplanations ?? [],
        topic: q.topic ?? "",
        cardId: q.cardId ?? null,
        media: q.media ?? { kind: "none" as const },
      })),
    )
    .returning();
}

export async function listLiveBattleQuestions(
  sessionId: number,
): Promise<LiveBattleQuestionRow[]> {
  return db
    .select()
    .from(liveBattleQuestions)
    .where(eq(liveBattleQuestions.sessionId, sessionId))
    .orderBy(asc(liveBattleQuestions.sortOrder));
}

/** Lobby/scheduled only — clears prior questions before reissuing from a new card selection. */
export async function deleteLiveBattleQuestionsForSession(
  sessionId: number,
): Promise<void> {
  await db
    .delete(liveBattleQuestions)
    .where(eq(liveBattleQuestions.sessionId, sessionId));
}

export async function updateLiveBattleQuestion(
  id: number,
  patch: Partial<{
    prompt: string;
    choices: string[];
    correctIndex: number;
    explanation: string;
    distractorExplanations: string[];
    topic: string;
    cardId: number | null;
    media: LiveBattleQuestionRow["media"];
    revealed: boolean;
    aiExplanationShown: boolean;
    sortOrder: number;
  }>,
): Promise<LiveBattleQuestionRow | null> {
  const [row] = await db
    .update(liveBattleQuestions)
    .set(patch)
    .where(eq(liveBattleQuestions.id, id))
    .returning();
  return row ?? null;
}

export async function insertLiveBattleAnswer(input: {
  sessionId: number;
  questionId: number;
  userId: string;
  liveTeamId?: number | null;
  choiceIndex: number;
  correct?: boolean;
  pointsAwarded?: number;
  speedBonus?: number;
  responseTimeMs?: number;
  submittedAsCaptain?: boolean;
}): Promise<LiveBattleAnswerRow> {
  const [row] = await db
    .insert(liveBattleAnswers)
    .values({
      sessionId: input.sessionId,
      questionId: input.questionId,
      userId: input.userId,
      liveTeamId: input.liveTeamId ?? null,
      choiceIndex: input.choiceIndex,
      correct: input.correct ?? false,
      pointsAwarded: input.pointsAwarded ?? 0,
      speedBonus: input.speedBonus ?? 0,
      responseTimeMs: input.responseTimeMs ?? 0,
      submittedAsCaptain: input.submittedAsCaptain ?? false,
    })
    .returning();
  if (!row) throw new Error("Failed to insert live battle answer");
  return row;
}

export async function listLiveBattleAnswersForSession(
  sessionId: number,
): Promise<LiveBattleAnswerRow[]> {
  return db
    .select()
    .from(liveBattleAnswers)
    .where(eq(liveBattleAnswers.sessionId, sessionId))
    .orderBy(asc(liveBattleAnswers.createdAt));
}

export async function listLiveBattleAnswersForQuestion(
  questionId: number,
): Promise<LiveBattleAnswerRow[]> {
  return db
    .select()
    .from(liveBattleAnswers)
    .where(eq(liveBattleAnswers.questionId, questionId))
    .orderBy(asc(liveBattleAnswers.createdAt));
}

export async function getLiveBattleAnswer(
  questionId: number,
  userId: string,
): Promise<LiveBattleAnswerRow | null> {
  const [row] = await db
    .select()
    .from(liveBattleAnswers)
    .where(
      and(
        eq(liveBattleAnswers.questionId, questionId),
        eq(liveBattleAnswers.userId, userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function insertLiveBattleStrategyCards(
  sessionId: number,
  cards: Array<{ liveTeamId: number; kind: LiveClassroomStrategyCardKind }>,
): Promise<LiveBattleStrategyCardRow[]> {
  if (cards.length === 0) return [];
  return db
    .insert(liveBattleStrategyCards)
    .values(
      cards.map((card) => ({
        sessionId,
        liveTeamId: card.liveTeamId,
        kind: card.kind,
      })),
    )
    .returning();
}

export async function listLiveBattleStrategyCards(
  sessionId: number,
): Promise<LiveBattleStrategyCardRow[]> {
  return db
    .select()
    .from(liveBattleStrategyCards)
    .where(eq(liveBattleStrategyCards.sessionId, sessionId))
    .orderBy(asc(liveBattleStrategyCards.createdAt));
}

/** Remove not-yet-used strategy card instances so settings changes can reissue a fresh set. */
export async function deleteUnusedLiveBattleStrategyCards(
  sessionId: number,
): Promise<void> {
  await db
    .delete(liveBattleStrategyCards)
    .where(
      and(
        eq(liveBattleStrategyCards.sessionId, sessionId),
        isNull(liveBattleStrategyCards.usedAt),
      ),
    );
}

/**
 * Return an in-progress battle to the lobby without deleting the session.
 * Clears answer progress so the battle can be started again cleanly.
 */
export async function returnLiveClassroomSessionToLobby(
  sessionId: number,
  options?: { survivalHearts?: number },
): Promise<LiveClassroomSessionRow | null> {
  const hearts =
    options?.survivalHearts != null && options.survivalHearts > 0
      ? options.survivalHearts
      : 3;

  await db
    .delete(liveBattleAnswers)
    .where(eq(liveBattleAnswers.sessionId, sessionId));

  await db
    .update(liveBattleQuestions)
    .set({ revealed: false, aiExplanationShown: false })
    .where(eq(liveBattleQuestions.sessionId, sessionId));

  await db
    .update(liveBattleStrategyCards)
    .set({
      usedAt: null,
      usedByUserId: null,
      questionId: null,
    })
    .where(eq(liveBattleStrategyCards.sessionId, sessionId));

  await db
    .update(liveClassroomParticipants)
    .set({
      correctCount: 0,
      incorrectCount: 0,
      totalResponseTimeMs: 0,
      answersSubmitted: 0,
      updatedAt: new Date(),
    })
    .where(eq(liveClassroomParticipants.sessionId, sessionId));

  await db
    .update(liveClassroomTeams)
    .set({
      score: 0,
      hearts,
      eliminated: false,
      updatedAt: new Date(),
    })
    .where(eq(liveClassroomTeams.sessionId, sessionId));

  const existing = await getLiveClassroomSessionById(sessionId);
  const {
    battleStartsAt: _drop,
    participantBattle: _pb,
    questionTimerBonuses: _tb,
    questionRevealTargets: _rt,
    participantClocks: _pc,
    ...restExtensions
  } = existing?.extensions ?? {};
  void _drop;
  void _pb;
  void _tb;
  void _rt;
  void _pc;

  return updateLiveClassroomSession(sessionId, {
    status: "lobby",
    currentQuestionIndex: 0,
    questionStartedAt: null,
    // Keep teams locked and leave liveTeamId assignments intact so a restart
    // restores the same roster (unassigned stay unassigned).
    teamsLocked: existing?.teamsLocked ?? true,
    startedAt: null,
    endedAt: null,
    extensions: restExtensions,
  });
}

/** Close a lobby/scheduled session without starting a battle (frees concurrent slot). */
export async function cancelLiveClassroomLobbySession(
  sessionId: number,
): Promise<LiveClassroomSessionRow | null> {
  const existing = await getLiveClassroomSessionById(sessionId);
  if (!existing) return null;
  if (existing.status !== "lobby" && existing.status !== "scheduled") {
    return null;
  }

  const {
    battleStartsAt: _drop,
    participantBattle: _pb,
    questionTimerBonuses: _tb,
    questionRevealTargets: _rt,
    participantClocks: _pc,
    ...restExtensions
  } = existing.extensions ?? {};
  void _drop;
  void _pb;
  void _tb;
  void _rt;
  void _pc;

  return updateLiveClassroomSession(sessionId, {
    status: "cancelled",
    endedAt: new Date(),
    questionStartedAt: null,
    startedAt: null,
    extensions: restExtensions,
  });
}

export async function deleteLiveClassroomSession(
  sessionId: number,
): Promise<boolean> {
  const deleted = await db
    .delete(liveClassroomSessions)
    .where(eq(liveClassroomSessions.id, sessionId))
    .returning({ id: liveClassroomSessions.id });
  return deleted.length > 0;
}

export async function markStrategyCardUsed(
  id: number,
  input: {
    usedByUserId: string;
    questionId: number;
    eliminatedChoices?: number[];
  },
): Promise<LiveBattleStrategyCardRow | null> {
  const [row] = await db
    .update(liveBattleStrategyCards)
    .set({
      usedByUserId: input.usedByUserId,
      questionId: input.questionId,
      usedAt: new Date(),
      ...(input.eliminatedChoices
        ? { eliminatedChoices: input.eliminatedChoices }
        : {}),
    })
    .where(eq(liveBattleStrategyCards.id, id))
    .returning();
  return row ?? null;
}

export async function upsertLiveBattleReport(input: {
  sessionId: number;
  teamId: number;
  hostUserId: string;
  sessionName: string;
  stats: LiveClassroomReportStats;
  winnerTeamName?: string | null;
}): Promise<LiveBattleReportRow> {
  const [row] = await db
    .insert(liveBattleReports)
    .values({
      sessionId: input.sessionId,
      teamId: input.teamId,
      hostUserId: input.hostUserId,
      sessionName: input.sessionName,
      stats: input.stats,
      winnerTeamName: input.winnerTeamName ?? null,
    })
    .onConflictDoUpdate({
      target: liveBattleReports.sessionId,
      set: {
        teamId: input.teamId,
        hostUserId: input.hostUserId,
        sessionName: input.sessionName,
        stats: input.stats,
        winnerTeamName: input.winnerTeamName ?? null,
      },
    })
    .returning();
  if (!row) throw new Error("Failed to upsert live battle report");
  return row;
}

export async function getLiveBattleReportBySession(
  sessionId: number,
): Promise<LiveBattleReportRow | null> {
  const [row] = await db
    .select()
    .from(liveBattleReports)
    .where(eq(liveBattleReports.sessionId, sessionId))
    .limit(1);
  return row ?? null;
}

export async function listLiveBattleReportsForTeam(
  teamId: number,
  limit = 50,
): Promise<LiveBattleReportRow[]> {
  return db
    .select()
    .from(liveBattleReports)
    .where(eq(liveBattleReports.teamId, teamId))
    .orderBy(desc(liveBattleReports.createdAt))
    .limit(limit);
}

export async function bumpLiveTeacherAnalytics(input: {
  teamId: number;
  teacherUserId: string;
  sessionsHostedDelta?: number;
  totalAttendanceDelta?: number;
  battleWinsDelta?: number;
  strategyCardsUsedDelta?: number;
  averageAccuracyPercent?: number;
  lastSessionAt?: Date | null;
}): Promise<LiveTeacherAnalyticsRow> {
  const now = new Date();
  const sessionsHostedDelta = input.sessionsHostedDelta ?? 0;
  const totalAttendanceDelta = input.totalAttendanceDelta ?? 0;
  const battleWinsDelta = input.battleWinsDelta ?? 0;
  const strategyCardsUsedDelta = input.strategyCardsUsedDelta ?? 0;

  const [row] = await db
    .insert(liveTeacherAnalytics)
    .values({
      teamId: input.teamId,
      teacherUserId: input.teacherUserId,
      sessionsHosted: Math.max(0, sessionsHostedDelta),
      totalAttendance: Math.max(0, totalAttendanceDelta),
      averageAccuracyPercent: input.averageAccuracyPercent ?? 0,
      battleWins: Math.max(0, battleWinsDelta),
      strategyCardsUsed: Math.max(0, strategyCardsUsedDelta),
      lastSessionAt: input.lastSessionAt ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        liveTeacherAnalytics.teamId,
        liveTeacherAnalytics.teacherUserId,
      ],
      set: {
        sessionsHosted: sql`${liveTeacherAnalytics.sessionsHosted} + ${sessionsHostedDelta}`,
        totalAttendance: sql`${liveTeacherAnalytics.totalAttendance} + ${totalAttendanceDelta}`,
        battleWins: sql`${liveTeacherAnalytics.battleWins} + ${battleWinsDelta}`,
        strategyCardsUsed: sql`${liveTeacherAnalytics.strategyCardsUsed} + ${strategyCardsUsedDelta}`,
        averageAccuracyPercent:
          input.averageAccuracyPercent !== undefined
            ? input.averageAccuracyPercent
            : sql`${liveTeacherAnalytics.averageAccuracyPercent}`,
        lastSessionAt:
          input.lastSessionAt !== undefined
            ? input.lastSessionAt
            : sql`${liveTeacherAnalytics.lastSessionAt}`,
        updatedAt: now,
      },
    })
    .returning();
  if (!row) throw new Error("Failed to bump live teacher analytics");
  return row;
}

export async function bumpLiveOrganizationAnalytics(input: {
  teamId: number;
  totalSessionsDelta?: number;
  totalAttendanceDelta?: number;
  strategyCardsUsedDelta?: number;
  averageAttendance?: number;
  averageAccuracyPercent?: number;
  averageResponseTimeSec?: number;
  mostActiveTeacherUserId?: string | null;
}): Promise<LiveOrganizationAnalyticsRow> {
  const now = new Date();
  const totalSessionsDelta = input.totalSessionsDelta ?? 0;
  const totalAttendanceDelta = input.totalAttendanceDelta ?? 0;
  const strategyCardsUsedDelta = input.strategyCardsUsedDelta ?? 0;

  const [row] = await db
    .insert(liveOrganizationAnalytics)
    .values({
      teamId: input.teamId,
      totalSessions: Math.max(0, totalSessionsDelta),
      totalAttendance: Math.max(0, totalAttendanceDelta),
      averageAttendance: input.averageAttendance ?? 0,
      averageAccuracyPercent: input.averageAccuracyPercent ?? 0,
      averageResponseTimeSec: input.averageResponseTimeSec ?? 0,
      mostActiveTeacherUserId: input.mostActiveTeacherUserId ?? null,
      strategyCardsUsed: Math.max(0, strategyCardsUsedDelta),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: liveOrganizationAnalytics.teamId,
      set: {
        totalSessions: sql`${liveOrganizationAnalytics.totalSessions} + ${totalSessionsDelta}`,
        totalAttendance: sql`${liveOrganizationAnalytics.totalAttendance} + ${totalAttendanceDelta}`,
        strategyCardsUsed: sql`${liveOrganizationAnalytics.strategyCardsUsed} + ${strategyCardsUsedDelta}`,
        averageAttendance:
          input.averageAttendance !== undefined
            ? input.averageAttendance
            : sql`${liveOrganizationAnalytics.averageAttendance}`,
        averageAccuracyPercent:
          input.averageAccuracyPercent !== undefined
            ? input.averageAccuracyPercent
            : sql`${liveOrganizationAnalytics.averageAccuracyPercent}`,
        averageResponseTimeSec:
          input.averageResponseTimeSec !== undefined
            ? input.averageResponseTimeSec
            : sql`${liveOrganizationAnalytics.averageResponseTimeSec}`,
        mostActiveTeacherUserId:
          input.mostActiveTeacherUserId !== undefined
            ? input.mostActiveTeacherUserId
            : sql`${liveOrganizationAnalytics.mostActiveTeacherUserId}`,
        updatedAt: now,
      },
    })
    .returning();
  if (!row) throw new Error("Failed to bump live organization analytics");
  return row;
}

export async function getLiveOrganizationAnalytics(
  teamId: number,
): Promise<LiveOrganizationAnalyticsRow | null> {
  const [row] = await db
    .select()
    .from(liveOrganizationAnalytics)
    .where(eq(liveOrganizationAnalytics.teamId, teamId))
    .limit(1);
  return row ?? null;
}

export async function getLiveTeacherAnalytics(
  teamId: number,
  teacherUserId: string,
): Promise<LiveTeacherAnalyticsRow | null> {
  const [row] = await db
    .select()
    .from(liveTeacherAnalytics)
    .where(
      and(
        eq(liveTeacherAnalytics.teamId, teamId),
        eq(liveTeacherAnalytics.teacherUserId, teacherUserId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listLiveTeacherAnalyticsForTeam(
  teamId: number,
): Promise<LiveTeacherAnalyticsRow[]> {
  return db
    .select()
    .from(liveTeacherAnalytics)
    .where(eq(liveTeacherAnalytics.teamId, teamId))
    .orderBy(desc(liveTeacherAnalytics.sessionsHosted));
}

export async function listTodaysLiveSessions(
  teamId: number,
): Promise<LiveClassroomSessionRow[]> {
  const start = startOfUtcDay();
  const end = endOfUtcDay();

  return db
    .select()
    .from(liveClassroomSessions)
    .where(
      and(
        eq(liveClassroomSessions.teamId, teamId),
        sql`coalesce(${liveClassroomSessions.scheduledFor}, ${liveClassroomSessions.createdAt}) >= ${start}`,
        sql`coalesce(${liveClassroomSessions.scheduledFor}, ${liveClassroomSessions.createdAt}) < ${end}`,
      ),
    )
    .orderBy(desc(liveClassroomSessions.createdAt));
}

export async function getDashboardLiveClassroomStats(teamId: number): Promise<{
  todaySessions: number;
  upcoming: number;
  previous: number;
  totalSessions: number;
  averageAttendance: number;
  averageAccuracy: number;
  mostActiveTeacherUserId: string | null;
}> {
  const now = new Date();
  const start = startOfUtcDay(now);
  const end = endOfUtcDay(now);

  const [[todayRow], [upcomingRow], [previousRow], org] = await Promise.all([
    db
      .select({ value: count() })
      .from(liveClassroomSessions)
      .where(
        and(
          eq(liveClassroomSessions.teamId, teamId),
          sql`coalesce(${liveClassroomSessions.scheduledFor}, ${liveClassroomSessions.createdAt}) >= ${start}`,
          sql`coalesce(${liveClassroomSessions.scheduledFor}, ${liveClassroomSessions.createdAt}) < ${end}`,
        ),
      ),
    db
      .select({ value: count() })
      .from(liveClassroomSessions)
      .where(
        and(
          eq(liveClassroomSessions.teamId, teamId),
          or(
            eq(liveClassroomSessions.status, "scheduled"),
            and(
              eq(liveClassroomSessions.status, "lobby"),
              gte(liveClassroomSessions.scheduledFor, now),
            ),
          ),
        ),
      ),
    db
      .select({ value: count() })
      .from(liveClassroomSessions)
      .where(
        and(
          eq(liveClassroomSessions.teamId, teamId),
          inArray(liveClassroomSessions.status, ["completed", "cancelled"]),
        ),
      ),
    getLiveOrganizationAnalytics(teamId),
  ]);

  return {
    todaySessions: todayRow?.value ?? 0,
    upcoming: upcomingRow?.value ?? 0,
    previous: previousRow?.value ?? 0,
    totalSessions: org?.totalSessions ?? 0,
    averageAttendance: org?.averageAttendance ?? 0,
    averageAccuracy: org?.averageAccuracyPercent ?? 0,
    mostActiveTeacherUserId: org?.mostActiveTeacherUserId ?? null,
  };
}
