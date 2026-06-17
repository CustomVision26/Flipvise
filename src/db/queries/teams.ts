import { db } from "@/db";
import {
  cards,
  deckWorkspaceLinks,
  decks,
  teamDeckAssignments,
  teamInvitations,
  teamMembers,
  teamOwnerQuizDefaults,
  teams,
  type TeamInvitationRow,
  type TeamMemberRow,
} from "@/db/schema";
import {
  deckRowSelectWithoutCover,
  getDeckRowById,
  isMissingDeckCoverColumnError,
  type DeckRow,
} from "@/db/queries/decks";
import {
  canonicalTeamPlanId,
  isTeamPlanId,
  labelForTeamPlanSlug,
} from "@/lib/team-plans";
import {
  isMemberWithinMemberLimit,
  isTeamWithinWorkspaceLimit,
  selectNewestTeamsWithinWorkspaceLimit,
} from "@/lib/team-plan-limit-selection";
import { getClerkUserDisplayNameById } from "@/lib/clerk-user-display";
import type { TeamWorkspaceNavTeam } from "@/lib/team-workspace-url";
import { FREE_PERSONAL_WORKSPACE_NAV_TEAM_LIMIT } from "@/lib/workspace-nav-limits";
import {
  defaultTeamMemberStudyPrivilege,
  type TeamMemberStudyPrivilege,
} from "@/lib/team-study-privilege";
import {
  DEFAULT_TEAM_QUIZ_DURATION_MINUTES,
  resolveTeamQuizDurationMinutes,
  type OwnerQuizDefaultSettings,
  type QuizTimerWorkspaceSnapshot,
  type TeamQuizDurationContext,
} from "@/lib/team-quiz-duration";
import {
  and,
  count,
  desc,
  eq,
  exists,
  getTableColumns,
  gt,
  inArray,
  isNull,
  isNotNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import type { InferSelectModel, SQL } from "drizzle-orm";

export type { TeamMemberRow, TeamInvitationRow };

export type TeamMemberRole = "team_admin" | "team_member";

/** Invited members with this role can receive workspace deck assignments (Study view). */
export function roleReceivesDeckAssignments(role: TeamMemberRole): boolean {
  return role === "team_member" || role === "team_admin";
}

let warnedMissingDeckWorkspaceLinksTable = false;
function warnMissingDeckWorkspaceLinksTableOnce() {
  if (warnedMissingDeckWorkspaceLinksTable) return;
  warnedMissingDeckWorkspaceLinksTable = true;
  console.warn(
    "[db] `deck_workspace_links` is missing — apply Drizzle migration 0022_deck_workspace_links. Using legacy team deck visibility until then.",
  );
}

/** When `deck_workspace_links` is not migrated — avoid referencing the table. */
function isMissingDeckWorkspaceLinksTableError(error: unknown): boolean {
  if (error === null || error === undefined) return false;
  let current: unknown = error;
  const seen = new Set<unknown>();
  for (let depth = 0; depth < 8 && current != null && !seen.has(current); depth++) {
    seen.add(current);
    if (typeof current === "object" && current !== null && "code" in current) {
      const code = String((current as { code?: string | number }).code);
      const msg = String(
        (current as { message?: string }).message ??
          (current instanceof Error ? current.message : ""),
      );
      if (code === "42P01" && /deck_workspace_links/i.test(msg)) return true;
    }
    const msg =
      current instanceof Error
        ? current.message
        : typeof current === "object" &&
            current !== null &&
            "message" in current &&
            typeof (current as { message?: unknown }).message === "string"
          ? (current as { message: string }).message
          : String(current);
    const lower = msg.toLowerCase();
    if (
      lower.includes("deck_workspace_links") &&
      (lower.includes("does not exist") ||
        lower.includes("undefined_table") ||
        lower.includes("42p01") ||
        lower.includes("failed query"))
    ) {
      return true;
    }
    const next =
      current instanceof Error
        ? current.cause
        : typeof current === "object" &&
            current !== null &&
            "cause" in current
          ? (current as { cause?: unknown }).cause
          : undefined;
    current = next;
  }
  return false;
}

/** When `team_invitations` is missing `inviteeDisplayName` (migration not run). */
const teamInvitationRowSelectLegacy = {
  id: teamInvitations.id,
  teamId: teamInvitations.teamId,
  invitedByUserId: teamInvitations.invitedByUserId,
  email: teamInvitations.email,
  role: teamInvitations.role,
  token: teamInvitations.token,
  status: teamInvitations.status,
  expiresAt: teamInvitations.expiresAt,
  createdAt: teamInvitations.createdAt,
} as const;

export function isMissingTeamInvitationInviteeDisplayNameColumnError(
  error: unknown,
): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth++) {
    const o = current as Record<string, unknown>;
    const message = typeof o.message === "string" ? o.message : "";
    if (
      /inviteeDisplayName|invitee_display_name/i.test(message) &&
      (/does not exist/i.test(message) || /42703/i.test(String(o.code ?? "")))
    ) {
      return true;
    }
    current = o.cause;
  }
  const flat = String(error);
  if (
    /42703/i.test(flat) &&
    /team_invitations/i.test(flat) &&
    /invitee/i.test(flat)
  ) {
    return true;
  }
  if (
    /inviteeDisplayName|invitee_display_name/i.test(flat) &&
    /does not exist/i.test(flat)
  ) {
    return true;
  }
  return false;
}

let warnedMissingInviteeDisplayNameColumn = false;

function warnMissingInviteeDisplayNameColumnOnce() {
  if (process.env.NODE_ENV !== "development") return;
  if (warnedMissingInviteeDisplayNameColumn) return;
  warnedMissingInviteeDisplayNameColumn = true;
  console.warn(
    "[db] team_invitations is missing inviteeDisplayName. Run: npm run db:migrate:local (or db:push:local) or apply drizzle/0017_team_invitation_invitee_display_name.sql",
  );
}

function withDefaultInviteeDisplayName(
  row: Omit<TeamInvitationRow, "inviteeDisplayName">,
): TeamInvitationRow {
  return { ...row, inviteeDisplayName: null };
}

/** When `team_members` is missing `updatedAt` / adder columns (migration not run). */
const teamMemberRowSelectLegacy = {
  id: teamMembers.id,
  teamId: teamMembers.teamId,
  userId: teamMembers.userId,
  role: teamMembers.role,
  createdAt: teamMembers.createdAt,
} as const;

export function isMissingTeamMemberAuditColumnError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth++) {
    const o = current as Record<string, unknown>;
    const code = o.code;
    if (code === "42703" || code === 42703) return true;
    const message = typeof o.message === "string" ? o.message : "";
    if (
      (/"updatedAt"/i.test(message) || /"addedByUserId"/i.test(message) || /"addedByAsOwner"/i.test(message) || /column .* team_members/i.test(message)) &&
      (/does not exist/i.test(message) || /undefined column/i.test(message))
    ) {
      return true;
    }
    current = o.cause;
  }
  const flat = String(error);
  // Never treat generic Neon "Failed query: … team_members …" as missing-column: that matches
  // duplicate key, FK failures, etc. and would incorrectly run the legacy insert.
  if (/42703/.test(flat) && /team_members/i.test(flat)) {
    return true;
  }
  if (
    /(updatedAt|addedByUserId|addedByAsOwner)/i.test(flat) &&
    /(does not exist|undefined column)/i.test(flat) &&
    /team_members/i.test(flat)
  ) {
    return true;
  }
  if (/Failed query:/i.test(flat) && /"updatedAt"/i.test(flat) && /team_members/i.test(flat)) {
    return true;
  }
  return false;
}

function isPostgresUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth++) {
    const o = current as Record<string, unknown>;
    if (o.code === "23505" || o.code === 23505) return true;
    current = o.cause;
  }
  const flat = String(error);
  return (
    /23505|unique constraint|team_members_team_user_uidx|duplicate key/i.test(flat)
  );
}

let warnedMissingTeamMemberAuditColumns = false;

function warnMissingTeamMemberAuditColumnsOnce() {
  if (process.env.NODE_ENV !== "development") return;
  if (warnedMissingTeamMemberAuditColumns) return;
  warnedMissingTeamMemberAuditColumns = true;
  console.warn(
    "[db] team_members is missing audit columns. Run: npm run db:migrate (or db:push:local) or apply drizzle/0010_team_member_audit.sql",
  );
}

function withDefaultTeamMemberAudit(
  row: {
    id: number;
    teamId: number;
    userId: string;
    role: TeamMemberRole;
    createdAt: Date;
  },
): TeamMemberRow {
  return {
    ...row,
    updatedAt: row.createdAt,
    addedByUserId: null,
    addedByAsOwner: null,
  };
}

export type DeckViewerAccess =
  | { kind: "owner" }
  | { kind: "team_admin"; teamId: number }
  | { kind: "team_member"; teamId: number };

export async function countTeamsForOwner(ownerUserId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(teams)
    .where(eq(teams.ownerUserId, ownerUserId));
  return Number(row?.n ?? 0);
}

type TeamRow = InferSelectModel<typeof teams>;

const teamRowSelectWithoutQuizSchedule = {
  id: teams.id,
  ownerUserId: teams.ownerUserId,
  name: teams.name,
  planSlug: teams.planSlug,
  quizDurationMinutes: teams.quizDurationMinutes,
  quizSecurityEnabled: teams.quizSecurityEnabled,
  quizFormatMultipleChoice: teams.quizFormatMultipleChoice,
  quizFormatTrueFalse: teams.quizFormatTrueFalse,
  quizFormatFillInBlank: teams.quizFormatFillInBlank,
  createdAt: teams.createdAt,
} as const;

function withDefaultTeamQuizSchedule(
  row: Omit<TeamRow, "quizStartScheduleEnabled" | "quizStartAt">,
): TeamRow {
  return {
    ...row,
    quizStartScheduleEnabled: false,
    quizStartAt: null,
  };
}

let warnedMissingQuizScheduleColumn = false;
function warnMissingQuizScheduleColumnOnce() {
  if (warnedMissingQuizScheduleColumn) return;
  warnedMissingQuizScheduleColumn = true;
  console.warn(
    "[db] Quiz schedule columns are missing. Run: npm run db:ensure-quiz-schedule-columns",
  );
}

function isMissingQuizScheduleColumnError(error: unknown): boolean {
  if (error === null || error === undefined) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return /quizStartScheduleEnabled|quizStartAt|quiz_start_schedule/i.test(msg);
}

async function selectTeamRows(where: SQL): Promise<TeamRow[]> {
  try {
    return await db.select().from(teams).where(where);
  } catch (e) {
    if (!isMissingQuizScheduleColumnError(e)) throw e;
    warnMissingQuizScheduleColumnOnce();
    const rows = await db.select(teamRowSelectWithoutQuizSchedule).from(teams).where(where);
    return rows.map(withDefaultTeamQuizSchedule);
  }
}

export async function getTeamsByOwner(ownerUserId: string) {
  return selectTeamRows(eq(teams.ownerUserId, ownerUserId));
}

export async function getTeamById(teamId: number) {
  const rows = await selectTeamRows(eq(teams.id, teamId));
  return rows[0] ?? null;
}

export async function getTeamsByIds(ids: number[]) {
  if (ids.length === 0) return [];
  return selectTeamRows(inArray(teams.id, ids));
}

export async function getMemberRecord(teamId: number, userId: string) {
  try {
    const rows = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
    return rows[0] ?? null;
  } catch (e) {
    if (!isMissingTeamMemberAuditColumnError(e)) throw e;
    warnMissingTeamMemberAuditColumnsOnce();
    const rows = await db
      .select(teamMemberRowSelectLegacy)
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
    const row = rows[0];
    return row ? withDefaultTeamMemberAudit(row) : null;
  }
}

/** All member rows for a set of team IDs — used to batch-resolve member roles. */
export async function listTeamMembersByTeamIds(teamIds: number[]) {
  if (teamIds.length === 0) return [];
  try {
    return await db
      .select()
      .from(teamMembers)
      .where(inArray(teamMembers.teamId, teamIds));
  } catch (e) {
    if (!isMissingTeamMemberAuditColumnError(e)) throw e;
    warnMissingTeamMemberAuditColumnsOnce();
    const rows = await db
      .select(teamMemberRowSelectLegacy)
      .from(teamMembers)
      .where(inArray(teamMembers.teamId, teamIds));
    return rows.map(withDefaultTeamMemberAudit);
  }
}

/** Teams where the user is a member (any role). */
export async function getTeamMembershipsForUser(userId: string) {
  try {
    return await db.select().from(teamMembers).where(eq(teamMembers.userId, userId));
  } catch (e) {
    if (!isMissingTeamMemberAuditColumnError(e)) throw e;
    warnMissingTeamMemberAuditColumnsOnce();
    const rows = await db
      .select(teamMemberRowSelectLegacy)
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));
    return rows.map(withDefaultTeamMemberAudit);
  }
}

export async function countMembersForTeam(teamId: number) {
  const [row] = await db
    .select({ n: count() })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));
  return Number(row?.n ?? 0);
}

export async function countPendingInvitationsForTeam(teamId: number) {
  const now = new Date();
  const [row] = await db
    .select({ n: count() })
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.teamId, teamId),
        eq(teamInvitations.status, "pending"),
        gt(teamInvitations.expiresAt, now),
      ),
    );
  return Number(row?.n ?? 0);
}

export async function listTeamMembers(teamId: number) {
  try {
    return await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId));
  } catch (e) {
    if (!isMissingTeamMemberAuditColumnError(e)) throw e;
    warnMissingTeamMemberAuditColumnsOnce();
    const rows = await db
      .select(teamMemberRowSelectLegacy)
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId));
    return rows.map(withDefaultTeamMemberAudit);
  }
}

/** Pending invites that are still valid (not past `expiresAt`). */
export async function listPendingInvitations(teamId: number) {
  const now = new Date();
  const whereClause = and(
    eq(teamInvitations.teamId, teamId),
    eq(teamInvitations.status, "pending"),
    gt(teamInvitations.expiresAt, now),
  );
  try {
    return await db
      .select()
      .from(teamInvitations)
      .where(whereClause)
      .orderBy(desc(teamInvitations.createdAt));
  } catch (e) {
    if (!isMissingTeamInvitationInviteeDisplayNameColumnError(e)) throw e;
    warnMissingInviteeDisplayNameColumnOnce();
    const rows = await db
      .select(teamInvitationRowSelectLegacy)
      .from(teamInvitations)
      .where(whereClause)
      .orderBy(desc(teamInvitations.createdAt));
    return rows.map(withDefaultInviteeDisplayName);
  }
}

/** Latest stored invitee label per normalized email across the given teams (by invitation `createdAt`). */
export async function getLatestInviteeDisplayNamesForTeamIds(teamIds: number[]) {
  if (teamIds.length === 0) return {} as Record<string, string>;
  try {
    const rows = await db
      .select({
        email: teamInvitations.email,
        inviteeDisplayName: teamInvitations.inviteeDisplayName,
        createdAt: teamInvitations.createdAt,
      })
      .from(teamInvitations)
      .where(
        and(
          inArray(teamInvitations.teamId, teamIds),
          isNotNull(teamInvitations.inviteeDisplayName),
        ),
      )
      .orderBy(desc(teamInvitations.createdAt));

    const out: Record<string, string> = {};
    for (const r of rows) {
      const key = r.email.toLowerCase();
      if (out[key]) continue;
      const name = r.inviteeDisplayName?.trim();
      if (name) out[key] = name;
    }
    return out;
  } catch (e) {
    if (!isMissingTeamInvitationInviteeDisplayNameColumnError(e)) throw e;
    warnMissingInviteeDisplayNameColumnOnce();
    return {};
  }
}

/** Past invitations for this team: terminal statuses, or pending but already expired. */
export async function listTeamInvitationHistoryForTeam(teamId: number) {
  const now = new Date();
  const whereClause = and(
    eq(teamInvitations.teamId, teamId),
    or(
      ne(teamInvitations.status, "pending"),
      and(eq(teamInvitations.status, "pending"), lte(teamInvitations.expiresAt, now)),
    ),
  );
  try {
    return await db
      .select()
      .from(teamInvitations)
      .where(whereClause)
      .orderBy(desc(teamInvitations.createdAt));
  } catch (e) {
    if (!isMissingTeamInvitationInviteeDisplayNameColumnError(e)) throw e;
    warnMissingInviteeDisplayNameColumnOnce();
    const rows = await db
      .select(teamInvitationRowSelectLegacy)
      .from(teamInvitations)
      .where(whereClause)
      .orderBy(desc(teamInvitations.createdAt));
    return rows.map(withDefaultInviteeDisplayName);
  }
}

/** Pending invite for this workspace and email that has not yet expired. */
export async function getActivePendingInvitationForTeamEmail(teamId: number, email: string) {
  const normalized = email.toLowerCase();
  const now = new Date();
  const whereClause = and(
    eq(teamInvitations.teamId, teamId),
    eq(teamInvitations.email, normalized),
    eq(teamInvitations.status, "pending"),
    gt(teamInvitations.expiresAt, now),
  );
  try {
    const rows = await db.select().from(teamInvitations).where(whereClause).limit(1);
    return rows[0] ?? null;
  } catch (e) {
    if (!isMissingTeamInvitationInviteeDisplayNameColumnError(e)) throw e;
    warnMissingInviteeDisplayNameColumnOnce();
    const rows = await db
      .select(teamInvitationRowSelectLegacy)
      .from(teamInvitations)
      .where(whereClause)
      .limit(1);
    const row = rows[0];
    return row ? withDefaultInviteeDisplayName(row) : null;
  }
}

/** Deck appears in this subscriber workspace library via explicit link (multi-workspace sharing). */
function decksLinkedToSubscriberWorkspaceWhere(teamId: number) {
  return exists(
    db
      .select({ one: sql`1` })
      .from(deckWorkspaceLinks)
      .where(
        and(
          eq(deckWorkspaceLinks.teamId, teamId),
          eq(deckWorkspaceLinks.deckId, decks.id),
        ),
      ),
  );
}

/** Decks surfaced for Team Admin assign/move: FK-scoped, link-scoped, plus subscriber decks already assigned here. */
function decksForSubscriberWorkspaceWhere(teamId: number, ownerUserId: string) {
  return and(
    eq(decks.userId, ownerUserId),
    or(
      eq(decks.teamId, teamId),
      decksLinkedToSubscriberWorkspaceWhere(teamId),
      exists(
        db
          .select({ one: sql`1` })
          .from(teamDeckAssignments)
          .where(
            and(
              eq(teamDeckAssignments.teamId, teamId),
              eq(teamDeckAssignments.deckId, decks.id),
            ),
          ),
      ),
    ),
  );
}

/** Before `deck_workspace_links` exists — only `decks.teamId` and assignment rows define workspace visibility. */
function decksForSubscriberWorkspaceWhereWithoutWorkspaceLinks(
  teamId: number,
  ownerUserId: string,
) {
  return and(
    eq(decks.userId, ownerUserId),
    or(
      eq(decks.teamId, teamId),
      exists(
        db
          .select({ one: sql`1` })
          .from(teamDeckAssignments)
          .where(
            and(
              eq(teamDeckAssignments.teamId, teamId),
              eq(teamDeckAssignments.deckId, decks.id),
            ),
          ),
      ),
    ),
  );
}

export async function getDecksForTeam(
  teamId: number,
  ownerUserId: string,
): Promise<DeckRow[]> {
  async function run(where: ReturnType<typeof decksForSubscriberWorkspaceWhere>): Promise<DeckRow[]> {
    try {
      return await db.select().from(decks).where(where);
    } catch (e) {
      if (!isMissingDeckCoverColumnError(e)) throw e;
      const rows = await db
        .select(deckRowSelectWithoutCover)
        .from(decks)
        .where(where);
      return rows.map((r) => ({
        ...r,
        coverImageUrl: null,
        gradient: null,
      }));
    }
  }

  try {
    return await run(decksForSubscriberWorkspaceWhere(teamId, ownerUserId));
  } catch (e) {
    if (!isMissingDeckWorkspaceLinksTableError(e)) throw e;
    warnMissingDeckWorkspaceLinksTableOnce();
    return run(decksForSubscriberWorkspaceWhereWithoutWorkspaceLinks(teamId, ownerUserId));
  }
}

export async function getDecksForTeamWithCardCount(
  teamId: number,
  ownerUserId: string,
) {
  const build = (where: ReturnType<typeof decksForSubscriberWorkspaceWhere>) =>
    db
      .select({
        id: decks.id,
        userId: decks.userId,
        name: decks.name,
        description: decks.description,
        coverImageUrl: decks.coverImageUrl,
        createdAt: decks.createdAt,
        updatedAt: decks.updatedAt,
        cardCount: count(cards.id),
      })
      .from(decks)
      .leftJoin(cards, eq(cards.deckId, decks.id))
      .where(where)
      .groupBy(
        decks.id,
        decks.userId,
        decks.name,
        decks.description,
        decks.coverImageUrl,
        decks.createdAt,
        decks.updatedAt,
      );

  try {
    return await build(decksForSubscriberWorkspaceWhere(teamId, ownerUserId));
  } catch (e) {
    if (!isMissingDeckWorkspaceLinksTableError(e)) throw e;
    warnMissingDeckWorkspaceLinksTableOnce();
    return build(decksForSubscriberWorkspaceWhereWithoutWorkspaceLinks(teamId, ownerUserId));
  }
}

export async function getAssignedDecksForMember(
  teamId: number,
  memberUserId: string,
): Promise<DeckRow[]> {
  try {
    return await db
      .select(getTableColumns(decks))
      .from(teamDeckAssignments)
      .innerJoin(decks, eq(teamDeckAssignments.deckId, decks.id))
      .where(
        and(
          eq(teamDeckAssignments.teamId, teamId),
          eq(teamDeckAssignments.memberUserId, memberUserId),
        ),
      );
  } catch (e) {
    if (!isMissingDeckCoverColumnError(e)) throw e;
    const rows = await db
      .select(deckRowSelectWithoutCover)
      .from(teamDeckAssignments)
      .innerJoin(decks, eq(teamDeckAssignments.deckId, decks.id))
      .where(
        and(
          eq(teamDeckAssignments.teamId, teamId),
          eq(teamDeckAssignments.memberUserId, memberUserId),
        ),
      );
    return rows.map((r) => ({
      ...r,
      coverImageUrl: null,
      gradient: null,
    }));
  }
}

export async function getAssignedDecksForMemberWithCardCount(
  teamId: number,
  memberUserId: string,
) {
  return db
    .select({
      id: decks.id,
      userId: decks.userId,
      teamId: decks.teamId,
      name: decks.name,
      description: decks.description,
      coverImageUrl: decks.coverImageUrl,
      createdAt: decks.createdAt,
      updatedAt: decks.updatedAt,
      cardCount: count(cards.id),
    })
    .from(teamDeckAssignments)
    .innerJoin(decks, eq(teamDeckAssignments.deckId, decks.id))
    .leftJoin(cards, eq(cards.deckId, decks.id))
    .where(
      and(
        eq(teamDeckAssignments.teamId, teamId),
        eq(teamDeckAssignments.memberUserId, memberUserId),
      ),
    )
    .groupBy(
      decks.id,
      decks.userId,
      decks.teamId,
      decks.name,
      decks.description,
      decks.coverImageUrl,
      decks.createdAt,
      decks.updatedAt,
    );
}

export async function isDeckLinkedToWorkspace(
  teamId: number,
  deckId: number,
): Promise<boolean> {
  try {
    const [row] = await db
      .select({ one: sql`1` })
      .from(deckWorkspaceLinks)
      .where(
        and(eq(deckWorkspaceLinks.teamId, teamId), eq(deckWorkspaceLinks.deckId, deckId)),
      )
      .limit(1);
    return row != null;
  } catch (e) {
    if (isMissingDeckWorkspaceLinksTableError(e)) return false;
    throw e;
  }
}

/** Deck is in the workspace tied to the joined `team_members` row (correlated subqueries). */
function deckInJoinedSubscriberWorkspaceWhere(includeWorkspaceLinks: boolean) {
  const workspaceMatch = [
    eq(decks.teamId, teamMembers.teamId),
    ...(includeWorkspaceLinks
      ? [
          exists(
            db
              .select({ one: sql`1` })
              .from(deckWorkspaceLinks)
              .where(
                and(
                  eq(deckWorkspaceLinks.teamId, teamMembers.teamId),
                  eq(deckWorkspaceLinks.deckId, decks.id),
                ),
              ),
          ),
        ]
      : []),
    exists(
      db
        .select({ one: sql`1` })
        .from(teamDeckAssignments)
        .where(
          and(
            eq(teamDeckAssignments.teamId, teamMembers.teamId),
            eq(teamDeckAssignments.deckId, decks.id),
          ),
        ),
    ),
  ];
  return and(eq(decks.userId, teams.ownerUserId), or(...workspaceMatch));
}

/** Co-admin access to any deck listed in a subscriber workspace (not only personal assignments). */
async function resolveTeamAdminWorkspaceDeckAccess(
  deckId: number,
  deckOwnerUserId: string,
  viewerUserId: string,
): Promise<number | null> {
  const run = async (includeWorkspaceLinks: boolean) => {
    const [row] = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .innerJoin(
        decks,
        and(eq(decks.id, deckId), eq(decks.userId, teams.ownerUserId)),
      )
      .where(
        and(
          eq(teamMembers.userId, viewerUserId),
          eq(teamMembers.role, "team_admin"),
          eq(teams.ownerUserId, deckOwnerUserId),
          deckInJoinedSubscriberWorkspaceWhere(includeWorkspaceLinks),
        ),
      )
      .limit(1);
    return row?.teamId ?? null;
  };

  try {
    return await run(true);
  } catch (e) {
    if (!isMissingDeckWorkspaceLinksTableError(e)) throw e;
    warnMissingDeckWorkspaceLinksTableOnce();
    return run(false);
  }
}

async function viewerHasActiveTeamMembershipAccess(
  teamId: number,
  viewerUserId: string,
): Promise<boolean> {
  const team = await getTeamById(teamId);
  if (!team || !isTeamPlanId(team.planSlug)) return false;
  const owned = await getTeamsByOwner(team.ownerUserId);
  if (!isTeamWithinWorkspaceLimit(teamId, owned, team.planSlug)) return false;
  const members = await listTeamMembers(teamId);
  return isMemberWithinMemberLimit(viewerUserId, members, team.planSlug);
}

/**
 * Co-admins on one workspace from a subscriber omit other `team_member`-only workspaces
 * from that same subscriber (stale member invites). Pure `team_member` users are unaffected.
 */
function shouldOmitMemberOnlyWorkspaceForCoAdmin(
  team: InferSelectModel<typeof teams>,
  viewerUserId: string,
  manageTeams: InferSelectModel<typeof teams>[],
): boolean {
  if (team.ownerUserId === viewerUserId) return false;
  return manageTeams.some((mt) => mt.ownerUserId === team.ownerUserId);
}

export async function resolveDeckViewerAccess(
  deckId: number,
  viewerUserId: string,
): Promise<DeckViewerAccess | null> {
  const deck = await getDeckRowById(deckId);
  if (!deck) return null;

  if (deck.userId === viewerUserId) {
    return { kind: "owner" };
  }

  /** Subscriber-owned decks with `teamId` unset are shared only via assignments. */
  if (!deck.teamId) {
    try {
      const memberPicks = await db
        .select({ teamId: teamDeckAssignments.teamId })
        .from(teamDeckAssignments)
        .innerJoin(teams, eq(teams.id, teamDeckAssignments.teamId))
        .where(
          and(
            eq(teamDeckAssignments.deckId, deck.id),
            eq(teamDeckAssignments.memberUserId, viewerUserId),
            eq(teams.ownerUserId, deck.userId),
          ),
        )
        .orderBy(desc(teamDeckAssignments.createdAt));

      for (const memberPick of memberPicks) {
        const memberRecord = await getMemberRecord(memberPick.teamId, viewerUserId);
        if (memberRecord?.role !== "team_member") continue;
        if (await viewerHasActiveTeamMembershipAccess(memberPick.teamId, viewerUserId)) {
          return { kind: "team_member", teamId: memberPick.teamId };
        }
      }

      let adminByLinkRows: { teamId: number }[] = [];
      try {
        adminByLinkRows = await db
          .select({ teamId: deckWorkspaceLinks.teamId })
          .from(deckWorkspaceLinks)
          .innerJoin(teams, eq(teams.id, deckWorkspaceLinks.teamId))
          .innerJoin(
            teamMembers,
            and(
              eq(teamMembers.teamId, deckWorkspaceLinks.teamId),
              eq(teamMembers.userId, viewerUserId),
              eq(teamMembers.role, "team_admin"),
            ),
          )
          .where(
            and(
              eq(deckWorkspaceLinks.deckId, deck.id),
              eq(teams.ownerUserId, deck.userId),
            ),
          )
          .orderBy(desc(deckWorkspaceLinks.createdAt));
      } catch (e) {
        if (!isMissingDeckWorkspaceLinksTableError(e)) throw e;
        warnMissingDeckWorkspaceLinksTableOnce();
      }

      for (const row of adminByLinkRows) {
        if (await viewerHasActiveTeamMembershipAccess(row.teamId, viewerUserId)) {
          return { kind: "team_admin", teamId: row.teamId };
        }
      }

      const adminPicks = await db
        .select({ teamId: teamMembers.teamId })
        .from(teamMembers)
        .innerJoin(
          teamDeckAssignments,
          and(
            eq(teamDeckAssignments.teamId, teamMembers.teamId),
            eq(teamDeckAssignments.deckId, deck.id),
          ),
        )
        .innerJoin(teams, eq(teams.id, teamMembers.teamId))
        .where(
          and(
            eq(teamMembers.userId, viewerUserId),
            eq(teamMembers.role, "team_admin"),
            eq(teams.ownerUserId, deck.userId),
          ),
        )
        .orderBy(desc(teamDeckAssignments.createdAt));

      for (const adminPick of adminPicks) {
        if (await viewerHasActiveTeamMembershipAccess(adminPick.teamId, viewerUserId)) {
          return { kind: "team_admin", teamId: adminPick.teamId };
        }
      }

      const workspaceAdminTeamId = await resolveTeamAdminWorkspaceDeckAccess(
        deck.id,
        deck.userId,
        viewerUserId,
      );
      if (workspaceAdminTeamId != null) {
        if (await viewerHasActiveTeamMembershipAccess(workspaceAdminTeamId, viewerUserId)) {
          return { kind: "team_admin", teamId: workspaceAdminTeamId };
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  try {
    const team = await getTeamById(deck.teamId);
    if (!team) return null;

    if (team.ownerUserId === viewerUserId) {
      return { kind: "owner" };
    }

    const member = await getMemberRecord(deck.teamId, viewerUserId);
    if (!member) return null;

    if (member.role === "team_admin") {
      if (!(await viewerHasActiveTeamMembershipAccess(deck.teamId, viewerUserId))) {
        return null;
      }
      return { kind: "team_admin", teamId: deck.teamId };
    }

    const assignedRows = await db
      .select()
      .from(teamDeckAssignments)
      .where(
        and(
          eq(teamDeckAssignments.teamId, deck.teamId),
          eq(teamDeckAssignments.deckId, deckId),
          eq(teamDeckAssignments.memberUserId, viewerUserId),
        ),
      )
      .limit(1);

    if (assignedRows.length === 0) return null;

    if (member.role === "team_member") {
      if (!(await viewerHasActiveTeamMembershipAccess(deck.teamId, viewerUserId))) {
        return null;
      }
      return { kind: "team_member", teamId: deck.teamId };
    }

    return null;
  } catch {
    return null;
  }
}

/** Teams the user owns or manages as `team_admin` (for `/dashboard/team-admin`). */
export async function getTeamsForTeamDashboard(userId: string) {
  const owned = await getTeamsByOwner(userId);
  const ownedPlanTeam = owned.find((t) => isTeamPlanId(t.planSlug));
  const ownedAccessible =
    ownedPlanTeam != null
      ? selectNewestTeamsWithinWorkspaceLimit(owned, ownedPlanTeam.planSlug)
      : owned;

  const adminRows = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(and(eq(teamMembers.userId, userId), eq(teamMembers.role, "team_admin")));
  const ids = [...new Set(adminRows.map((r) => r.teamId))].filter(Boolean);
  const extra = ids.length > 0 ? await selectTeamRows(inArray(teams.id, ids)) : [];

  const extraAccessible: InferSelectModel<typeof teams>[] = [];
  for (const t of extra) {
    if (!isTeamPlanId(t.planSlug)) continue;
    const subscriberOwned = await getTeamsByOwner(t.ownerUserId);
    if (!isTeamWithinWorkspaceLimit(t.id, subscriberOwned, t.planSlug)) continue;
    const members = await listTeamMembers(t.id);
    if (!isMemberWithinMemberLimit(userId, members, t.planSlug)) continue;
    extraAccessible.push(t);
  }

  const map = new Map<number, InferSelectModel<typeof teams>>();
  for (const t of [...ownedAccessible, ...extraAccessible]) {
    map.set(t.id, t);
  }
  return [...map.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * Team-tier workspaces shown in the header switcher — aligned with `/dashboard/team-admin`:
 * - **Subscriber owners** see every team workspace they own, plus any `team_member` workspaces (study).
 * - **Invited co-admins** who co-manage a workspace omit other `team_member`-only workspaces from the
 *   same subscriber (stale member invites).
 * - **Pure team members** (no ownership, no `team_admin`) see each `team_member` workspace for study.
 */
export async function getEligibleWorkspaceTeamsForUser(
  userId: string,
  bootstrap?: HeaderTeamsBootstrap,
) {
  const manageTeams =
    bootstrap?.manageTeams ?? (await getTeamsForTeamDashboard(userId));
  const memberships =
    bootstrap?.memberships ?? (await getTeamMembershipsForUser(userId));

  const memberOnlyIds = [
    ...new Set(
      memberships.filter((m) => m.role === "team_member").map((m) => m.teamId),
    ),
  ];
  const memberOnlyTeams =
    memberOnlyIds.length > 0 ? await getTeamsByIds(memberOnlyIds) : [];

  const map = new Map<number, InferSelectModel<typeof teams>>();
  for (const t of manageTeams) {
    if (isTeamPlanId(t.planSlug)) map.set(t.id, t);
  }
  for (const t of memberOnlyTeams) {
    if (!isTeamPlanId(t.planSlug)) continue;
    if (shouldOmitMemberOnlyWorkspaceForCoAdmin(t, userId, manageTeams)) continue;
    if (!(await viewerHasActiveTeamMembershipAccess(t.id, userId))) continue;
    map.set(t.id, t);
  }

  return [...map.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

function planLabelForTeam(planSlug: string): string {
  return labelForTeamPlanSlug(planSlug) ?? planSlug;
}

export type WorkspaceNavTeamsResult = {
  /** Teams the user may select (limited for free personal accounts). */
  teams: TeamWorkspaceNavTeam[];
  /** Count of workspaces in the switcher (owned within plan + invited/member). */
  totalEligibleCount: number;
};

/** One Drizzle snapshot shared between team-admin header + workspace nav in root layout. */
export type HeaderTeamsBootstrap = {
  manageTeams: InferSelectModel<typeof teams>[];
  memberships: InferSelectModel<typeof teamMembers>[];
};

export type RootLayoutTeamAdminHeaderTeam = {
  id: number;
  name: string;
  ownerUserId: string;
  workspacePlanQuery?: string;
  teamMemberUrlParam: number;
};

/**
 * Header workspace switcher: `teamMemberUrlParam` is 0 for the subscriber owner, else the
 * viewer’s `team_members.id` (for display grouping). Workspace dashboard URLs include
 * `team`, `userid`, `plan`, and `teamMemberId`.
 * Subscriber-owned team-tier workspaces within plan limits appear as “Team: …” rows (open
 * `/dashboard?team=`). Personal Pro (or admin unlock) lists every eligible team; Free personal
 * shows at most {@link FREE_PERSONAL_WORKSPACE_NAV_TEAM_LIMIT} (oldest first).
 */
export async function getWorkspaceNavTeamsForUser(
  userId: string,
  options: { personalProUnlocked: boolean },
  bootstrap?: HeaderTeamsBootstrap,
): Promise<WorkspaceNavTeamsResult> {
  const memberships =
    bootstrap?.memberships ?? (await getTeamMembershipsForUser(userId));
  const manageTeams =
    bootstrap?.manageTeams ?? (await getTeamsForTeamDashboard(userId));

  const eligible = await getEligibleWorkspaceTeamsForUser(userId, bootstrap);
  const invitedForSwitcher = eligible.filter((t) => {
    const isSubscriberOwnedTeamTier =
      t.ownerUserId === userId && isTeamPlanId(t.planSlug);
    return !isSubscriberOwnedTeamTier;
  });

  const ownedForSwitcher = manageTeams.filter(
    (t) => t.ownerUserId === userId && isTeamPlanId(t.planSlug),
  );

  const byId = new Map<number, InferSelectModel<typeof teams>>();
  for (const t of ownedForSwitcher) byId.set(t.id, t);
  for (const t of invitedForSwitcher) byId.set(t.id, t);

  const memberTeamIds = [
    ...new Set(
      memberships.filter((m) => m.role === "team_member").map((m) => m.teamId),
    ),
  ];
  if (memberTeamIds.length > 0) {
    const memberTeams = await getTeamsByIds(memberTeamIds);
    for (const t of memberTeams) {
      if (!isTeamPlanId(t.planSlug)) continue;
      if (byId.has(t.id)) continue;
      if (shouldOmitMemberOnlyWorkspaceForCoAdmin(t, userId, manageTeams)) continue;
      if (!(await viewerHasActiveTeamMembershipAccess(t.id, userId))) continue;
      byId.set(t.id, t);
    }
  }

  const eligibleForSwitcher = [...byId.values()].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const totalEligibleCount = eligibleForSwitcher.length;
  const membershipByTeamId = new Map(
    memberships.map((m) => [m.teamId, m] as const),
  );

  const ownerIds = [...new Set(eligibleForSwitcher.map((t) => t.ownerUserId))];
  const ownerDisplayNameById = new Map<string, string>();
  await Promise.all(
    ownerIds.map(async (oid) => {
      ownerDisplayNameById.set(oid, await getClerkUserDisplayNameById(oid));
    }),
  );

  const full = eligibleForSwitcher.map((t) => {
    const teamMemberUrlParam =
      t.ownerUserId === userId
        ? 0
        : (membershipByTeamId.get(t.id)?.id ?? 0);
    const membership = membershipByTeamId.get(t.id);
    const canAccessTeamAdmin =
      t.ownerUserId === userId || membership?.role === "team_admin";
    return {
      id: t.id,
      name: t.name,
      ownerUserId: t.ownerUserId,
      teamMemberUrlParam,
      planLabel: planLabelForTeam(t.planSlug),
      planUrlValue: canonicalTeamPlanId(t.planSlug) ?? "pro",
      ownerDisplayName: ownerDisplayNameById.get(t.ownerUserId) ?? "Subscriber",
      canAccessTeamAdmin,
      isSubscriberOwned: t.ownerUserId === userId,
    };
  });

  const navTeams = options.personalProUnlocked
    ? full
    : full.slice(0, FREE_PERSONAL_WORKSPACE_NAV_TEAM_LIMIT);

  return { teams: navTeams, totalEligibleCount };
}

/**
 * Single bootstrap for root layout: avoids repeating {@link getTeamsForTeamDashboard} /
 * {@link getTeamMembershipsForUser} and skips redundant {@link userHasTeamAdminDashboardAccess} queries.
 */
export async function getRootLayoutTeamNavPayload(
  userId: string,
  options: { personalProUnlocked: boolean },
): Promise<{
  teamAdminHeaderTeams: RootLayoutTeamAdminHeaderTeam[];
  workspaceNav: WorkspaceNavTeamsResult;
  teamMembershipCount: number;
}> {
  const [manageTeams, memberships] = await Promise.all([
    getTeamsForTeamDashboard(userId),
    getTeamMembershipsForUser(userId),
  ]);
  const bootstrap: HeaderTeamsBootstrap = { manageTeams, memberships };
  const workspaceNav = await getWorkspaceNavTeamsForUser(userId, options, bootstrap);
  const teamMembershipCount = memberships.length;

  if (manageTeams.length === 0) {
    return { teamAdminHeaderTeams: [], workspaceNav, teamMembershipCount };
  }

  const membershipByTeamId = new Map(
    memberships.map((m) => [m.teamId, m] as const),
  );

  const teamAdminHeaderTeams: RootLayoutTeamAdminHeaderTeam[] = manageTeams.map(
    (t) => ({
      id: t.id,
      name: t.name,
      ownerUserId: t.ownerUserId,
      workspacePlanQuery: isTeamPlanId(t.planSlug) ? t.planSlug : undefined,
      teamMemberUrlParam:
        t.ownerUserId === userId ? 0 : (membershipByTeamId.get(t.id)?.id ?? 0),
    }),
  );

  return { teamAdminHeaderTeams, workspaceNav, teamMembershipCount };
}

export async function userHasTeamAdminDashboardAccess(userId: string): Promise<boolean> {
  const owned = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.ownerUserId, userId))
    .limit(1);
  if (owned.length > 0) return true;

  const adminRow = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.userId, userId), eq(teamMembers.role, "team_admin")))
    .limit(1);
  return adminRow.length > 0;
}

export async function getInvitationByToken(token: string) {
  try {
    const rows = await db.select().from(teamInvitations).where(eq(teamInvitations.token, token));
    return rows[0] ?? null;
  } catch (e) {
    if (!isMissingTeamInvitationInviteeDisplayNameColumnError(e)) throw e;
    warnMissingInviteeDisplayNameColumnOnce();
    const rows = await db
      .select(teamInvitationRowSelectLegacy)
      .from(teamInvitations)
      .where(eq(teamInvitations.token, token));
    const row = rows[0];
    return row ? withDefaultInviteeDisplayName(row) : null;
  }
}

export async function insertTeam(
  ownerUserId: string,
  name: string,
  planSlug: string,
) {
  const [row] = await db
    .insert(teams)
    .values({ ownerUserId, name, planSlug })
    .returning({ id: teams.id });
  return row?.id;
}

/**
 * Sync all workspaces owned by a user to reflect their new resolved plan.
 *
 * Called after every plan change (admin assignment or Stripe webhook) so that
 * workspace limits — maxTeams / maxMembersPerTeam — always match the user's
 * current effective subscription rather than the plan at workspace creation time.
 *
 * When `resolvedPlanSlug` is a team plan id the workspace gains the correct
 * team-tier limits. When it is `"pro"` or `"free"` (personal / no team plan)
 * `isTeamPlanId` returns false and the workspace is effectively locked out of
 * team-tier features until the user re-subscribes to a team plan.
 */
export async function updateOwnedTeamsPlanSlug(
  ownerUserId: string,
  resolvedPlanSlug: string,
): Promise<void> {
  await db
    .update(teams)
    .set({ planSlug: resolvedPlanSlug })
    .where(eq(teams.ownerUserId, ownerUserId));

  if (isTeamPlanId(resolvedPlanSlug)) {
    const { enforceSubscriptionPlanLimitsForOwner } = await import(
      "@/db/queries/team-plan-limits"
    );
    await enforceSubscriptionPlanLimitsForOwner(ownerUserId, resolvedPlanSlug);
  }
}

export async function insertTeamMember(
  teamId: number,
  userId: string,
  role: TeamMemberRole,
  audit?: { addedByUserId: string; addedByAsOwner: boolean },
) {
  const now = new Date();
  try {
    await db.insert(teamMembers).values({
      teamId,
      userId,
      role,
      createdAt: now,
      updatedAt: now,
      ...(audit
        ? { addedByUserId: audit.addedByUserId, addedByAsOwner: audit.addedByAsOwner }
        : {}),
    });
  } catch (e) {
    if (isPostgresUniqueViolation(e)) {
      throw new Error("You are already a member of this team.");
    }
    if (!isMissingTeamMemberAuditColumnError(e)) throw e;
    warnMissingTeamMemberAuditColumnsOnce();
    try {
      // Drizzle's `.insert(teamMembers).values({ teamId, userId, role })` still emits every
      // schema column (with SQL DEFAULT). That fails on many real DB states. Insert only the
      // original core columns so Postgres applies real defaults for `createdAt` / `updatedAt`.
      await db.execute(
        sql`INSERT INTO team_members ("teamId", "userId", "role") VALUES (${teamId}, ${userId}, ${role})`,
      );
    } catch (e2) {
      if (isPostgresUniqueViolation(e2)) {
        throw new Error("You are already a member of this team.");
      }
      throw e2;
    }
  }
}

export async function deleteTeamMember(teamId: number, memberUserId: string) {
  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, memberUserId)));
}

export async function updateTeamMemberRole(
  teamId: number,
  memberUserId: string,
  role: TeamMemberRole,
) {
  try {
    await db
      .update(teamMembers)
      .set({ role, updatedAt: new Date() })
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, memberUserId)));
  } catch (e) {
    if (!isMissingTeamMemberAuditColumnError(e)) throw e;
    warnMissingTeamMemberAuditColumnsOnce();
    await db
      .update(teamMembers)
      .set({ role })
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, memberUserId)));
  }
}

export async function insertTeamInvitation(
  teamId: number,
  email: string,
  role: TeamMemberRole,
  token: string,
  expiresAt: Date,
  invitedByUserId: string,
  inviteeDisplayName?: string | null,
) {
  const label = inviteeDisplayName?.trim();
  try {
    await db.insert(teamInvitations).values({
      teamId,
      invitedByUserId,
      email: email.toLowerCase(),
      inviteeDisplayName: label && label.length > 0 ? label : null,
      role,
      token,
      expiresAt,
      status: "pending",
    });
  } catch (e) {
    if (
      !isMissingTeamInvitationInviteeDisplayNameColumnError(e) ||
      (label && label.length > 0)
    ) {
      throw e;
    }
    warnMissingInviteeDisplayNameColumnOnce();
    await db.insert(teamInvitations).values({
      teamId,
      invitedByUserId,
      email: email.toLowerCase(),
      role,
      token,
      expiresAt,
      status: "pending",
    });
  }
}

export async function deleteInvitation(invitationId: number, teamId: number) {
  await db
    .delete(teamInvitations)
    .where(and(eq(teamInvitations.id, invitationId), eq(teamInvitations.teamId, teamId)));
}

export async function markInvitationAccepted(invitationId: number) {
  await db
    .update(teamInvitations)
    .set({ status: "accepted" })
    .where(eq(teamInvitations.id, invitationId));
}

export async function markInvitationRejected(invitationId: number) {
  await db
    .update(teamInvitations)
    .set({ status: "rejected" })
    .where(eq(teamInvitations.id, invitationId));
}

/** Revokes an active pending invite (still within expiry). Returns the row id if updated. */
export async function revokePendingTeamInvitation(invitationId: number, teamId: number) {
  const now = new Date();
  const updated = await db
    .update(teamInvitations)
    .set({ status: "revoked" })
    .where(
      and(
        eq(teamInvitations.id, invitationId),
        eq(teamInvitations.teamId, teamId),
        eq(teamInvitations.status, "pending"),
        gt(teamInvitations.expiresAt, now),
      ),
    )
    .returning({ id: teamInvitations.id });
  return updated[0] ?? null;
}

/** Count of open (pending + non-expired) invitations for the inbox nav badge. */
export async function countPendingInvitationsForEmail(
  inviteeEmail: string,
): Promise<number> {
  const normalized = inviteeEmail.toLowerCase();
  const now = new Date();
  const rows = await db
    .select({ value: count() })
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.email, normalized),
        eq(teamInvitations.status, "pending"),
        gt(teamInvitations.expiresAt, now),
      ),
    );
  return rows[0]?.value ?? 0;
}

/** Invitations sent to this email (any status), newest first — for personal inbox. */
export async function listTeamInvitationsForInviteeEmail(inviteeEmail: string) {
  const normalized = inviteeEmail.toLowerCase();
  try {
    return db
      .select({
        invitation: teamInvitations,
        team: teams,
      })
      .from(teamInvitations)
      .innerJoin(teams, eq(teamInvitations.teamId, teams.id))
      .where(eq(teamInvitations.email, normalized))
      .orderBy(desc(teamInvitations.createdAt));
  } catch (e) {
    if (!isMissingTeamInvitationInviteeDisplayNameColumnError(e)) throw e;
    warnMissingInviteeDisplayNameColumnOnce();
    const rows = await db
      .select({
        ...teamInvitationRowSelectLegacy,
        team: teams,
      })
      .from(teamInvitations)
      .innerJoin(teams, eq(teamInvitations.teamId, teams.id))
      .where(eq(teamInvitations.email, normalized))
      .orderBy(desc(teamInvitations.createdAt));
    return rows.map((r) => ({
      invitation: withDefaultInviteeDisplayName({
        id: r.id,
        teamId: r.teamId,
        invitedByUserId: r.invitedByUserId,
        email: r.email,
        role: r.role,
        token: r.token,
        status: r.status,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
      }),
      team: r.team,
    }));
  }
}

export async function getTeamInvitationRowForInviteeEmail(
  invitationId: number,
  inviteeEmail: string,
) {
  const normalized = inviteeEmail.toLowerCase();
  const whereClause = and(
    eq(teamInvitations.id, invitationId),
    eq(teamInvitations.email, normalized),
  );
  try {
    const rows = await db.select().from(teamInvitations).where(whereClause).limit(1);
    return rows[0] ?? null;
  } catch (e) {
    if (!isMissingTeamInvitationInviteeDisplayNameColumnError(e)) throw e;
    warnMissingInviteeDisplayNameColumnOnce();
    const rows = await db
      .select(teamInvitationRowSelectLegacy)
      .from(teamInvitations)
      .where(whereClause)
      .limit(1);
    const row = rows[0];
    return row ? withDefaultInviteeDisplayName(row) : null;
  }
}

/** Projection when `team_deck_assignments` is missing audit columns (migration 0023 not applied). */
const teamDeckAssignmentListSelectLegacy = {
  teamId: teamDeckAssignments.teamId,
  deckId: teamDeckAssignments.deckId,
  memberUserId: teamDeckAssignments.memberUserId,
} as const;

let warnedMissingTeamDeckAssignmentAuditColumns = false;
function warnMissingTeamDeckAssignmentAuditColumnsOnce() {
  if (warnedMissingTeamDeckAssignmentAuditColumns) return;
  warnedMissingTeamDeckAssignmentAuditColumns = true;
  console.warn(
    "[db] `team_deck_assignments` is missing `assignedByUserId` / `createdAt` — apply migration `0023_team_deck_assignment_signed`.",
  );
}

function isMissingTeamDeckAssignmentAuditColumnError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 8 && current && typeof current === "object"; depth++) {
    const o = current as Record<string, unknown>;
    const code = o.code;
    const message = typeof o.message === "string" ? o.message : "";
    if (code === "42703" || code === 42703) {
      if (
        /assignedByUserId|createdAt/i.test(message) ||
        (/column/i.test(message) && /does not exist/i.test(message))
      ) {
        return true;
      }
    }
    if (
      /assignedByUserId|createdAt/i.test(message) &&
      (/does not exist/i.test(message) || /undefined column/i.test(message))
    ) {
      return true;
    }
    current = o.cause;
  }
  const flat = String(error);
  if (
    /Failed query:/i.test(flat) &&
    /insert into/i.test(flat) &&
    /team_deck_assignments/i.test(flat) &&
    (/assignedByUserId/i.test(flat) ||
      /"createdAt"/i.test(flat) ||
      /column .* does not exist/i.test(flat))
  ) {
    return true;
  }
  return false;
}

function isMissingTeamDeckAssignmentStudyPrivilegeColumnError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 8 && current && typeof current === "object"; depth++) {
    const o = current as Record<string, unknown>;
    const code = o.code;
    const message = typeof o.message === "string" ? o.message : "";
    if (code === "42703" || code === 42703) {
      if (
        /studyPrivilege/i.test(message) ||
        (/column/i.test(message) && /does not exist/i.test(message))
      ) {
        return true;
      }
    }
    if (
      /studyPrivilege/i.test(message) &&
      (/does not exist/i.test(message) || /undefined column/i.test(message))
    ) {
      return true;
    }
    current = o.cause;
  }
  const flat = String(error);
  return (
    /Failed query:/i.test(flat) &&
    /team_deck_assignments/i.test(flat) &&
    (/studyPrivilege/i.test(flat) || /team_member_study_privilege/i.test(flat))
  );
}

let warnedMissingTeamDeckAssignmentStudyPrivilegeColumn = false;
function warnMissingTeamDeckAssignmentStudyPrivilegeColumnOnce() {
  if (warnedMissingTeamDeckAssignmentStudyPrivilegeColumn) return;
  warnedMissingTeamDeckAssignmentStudyPrivilegeColumn = true;
  console.warn(
    "[db] `team_deck_assignments` is missing `studyPrivilege` — apply migration `0027_team_deck_study_privilege.sql`.",
  );
}

/** Normalized assignment row for admin UI (supports DB before migration 0023). */
export type TeamDeckAssignmentListRow = {
  teamId: number;
  deckId: number;
  memberUserId: string;
  assignedByUserId: string | null;
  createdAt: Date | null;
  studyPrivilege: TeamMemberStudyPrivilege;
};

export async function listAssignmentsForTeam(
  teamId: number,
): Promise<TeamDeckAssignmentListRow[]> {
  try {
    const rows = await db
      .select()
      .from(teamDeckAssignments)
      .where(eq(teamDeckAssignments.teamId, teamId));
    return rows.map((r) => ({
      teamId: r.teamId,
      deckId: r.deckId,
      memberUserId: r.memberUserId,
      assignedByUserId: r.assignedByUserId ?? null,
      createdAt: r.createdAt ?? null,
      studyPrivilege: r.studyPrivilege ?? defaultTeamMemberStudyPrivilege(),
    }));
  } catch (e) {
    if (
      !isMissingTeamDeckAssignmentAuditColumnError(e) &&
      !isMissingTeamDeckAssignmentStudyPrivilegeColumnError(e)
    ) {
      throw e;
    }
    if (isMissingTeamDeckAssignmentAuditColumnError(e)) {
      warnMissingTeamDeckAssignmentAuditColumnsOnce();
    }
    if (isMissingTeamDeckAssignmentStudyPrivilegeColumnError(e)) {
      warnMissingTeamDeckAssignmentStudyPrivilegeColumnOnce();
    }
    const rows = await db
      .select(teamDeckAssignmentListSelectLegacy)
      .from(teamDeckAssignments)
      .where(eq(teamDeckAssignments.teamId, teamId));
    return rows.map((r) => ({
      ...r,
      assignedByUserId: null,
      createdAt: null,
      studyPrivilege: defaultTeamMemberStudyPrivilege(),
    }));
  }
}

export async function insertDeckAssignment(
  teamId: number,
  deckId: number,
  memberUserId: string,
  assignedByUserId: string,
  studyPrivilege: TeamMemberStudyPrivilege = defaultTeamMemberStudyPrivilege(),
) {
  const createdAt = new Date();
  try {
    await db.execute(
      sql`INSERT INTO "team_deck_assignments" ("teamId", "deckId", "memberUserId", "assignedByUserId", "createdAt", "studyPrivilege")
          VALUES (${teamId}, ${deckId}, ${memberUserId}, ${assignedByUserId}, ${createdAt}, ${studyPrivilege}::team_member_study_privilege)
          ON CONFLICT ("teamId", "deckId", "memberUserId") DO UPDATE SET
            "assignedByUserId" = EXCLUDED."assignedByUserId",
            "studyPrivilege" = EXCLUDED."studyPrivilege"`,
    );
  } catch (e) {
    if (isMissingTeamDeckAssignmentStudyPrivilegeColumnError(e)) {
      warnMissingTeamDeckAssignmentStudyPrivilegeColumnOnce();
      try {
        await db.execute(
          sql`INSERT INTO "team_deck_assignments" ("teamId", "deckId", "memberUserId", "assignedByUserId", "createdAt")
              VALUES (${teamId}, ${deckId}, ${memberUserId}, ${assignedByUserId}, ${createdAt})
              ON CONFLICT ("teamId", "deckId", "memberUserId") DO UPDATE SET
                "assignedByUserId" = EXCLUDED."assignedByUserId"`,
        );
        return;
      } catch (inner) {
        if (!isMissingTeamDeckAssignmentAuditColumnError(inner)) throw inner;
      }
    }
    if (!isMissingTeamDeckAssignmentAuditColumnError(e)) throw e;
    warnMissingTeamDeckAssignmentAuditColumnsOnce();
    await db.execute(
      sql`INSERT INTO "team_deck_assignments" ("teamId", "deckId", "memberUserId")
          VALUES (${teamId}, ${deckId}, ${memberUserId})
          ON CONFLICT ("teamId", "deckId", "memberUserId") DO NOTHING`,
    );
  }
}

export async function getDeckAssignmentStudyPrivilege(
  teamId: number,
  deckId: number,
  memberUserId: string,
): Promise<TeamMemberStudyPrivilege> {
  try {
    const [row] = await db
      .select({ studyPrivilege: teamDeckAssignments.studyPrivilege })
      .from(teamDeckAssignments)
      .where(
        and(
          eq(teamDeckAssignments.teamId, teamId),
          eq(teamDeckAssignments.deckId, deckId),
          eq(teamDeckAssignments.memberUserId, memberUserId),
        ),
      )
      .limit(1);
    return row?.studyPrivilege ?? defaultTeamMemberStudyPrivilege();
  } catch (e) {
    if (!isMissingTeamDeckAssignmentStudyPrivilegeColumnError(e)) throw e;
    warnMissingTeamDeckAssignmentStudyPrivilegeColumnOnce();
    return defaultTeamMemberStudyPrivilege();
  }
}

export async function updateDeckAssignmentStudyPrivilege(
  teamId: number,
  deckId: number,
  memberUserId: string,
  studyPrivilege: TeamMemberStudyPrivilege,
) {
  try {
    await db
      .update(teamDeckAssignments)
      .set({ studyPrivilege })
      .where(
        and(
          eq(teamDeckAssignments.teamId, teamId),
          eq(teamDeckAssignments.deckId, deckId),
          eq(teamDeckAssignments.memberUserId, memberUserId),
        ),
      );
  } catch (e) {
    if (!isMissingTeamDeckAssignmentStudyPrivilegeColumnError(e)) throw e;
    warnMissingTeamDeckAssignmentStudyPrivilegeColumnOnce();
    throw new Error(
      "Database is missing study privilege support. Apply migration 0027_team_deck_study_privilege.sql.",
    );
  }
}

export async function deleteDeckAssignment(
  teamId: number,
  deckId: number,
  memberUserId: string,
) {
  await db
    .delete(teamDeckAssignments)
    .where(
      and(
        eq(teamDeckAssignments.teamId, teamId),
        eq(teamDeckAssignments.deckId, deckId),
        eq(teamDeckAssignments.memberUserId, memberUserId),
      ),
    );
}

/**
 * Link a subscriber-owned personal deck to a workspace they own. The same deck may be linked to
 * multiple owned workspaces (`deck_workspace_links`); `decks.teamId` stays null for that pattern.
 */
export async function attachPersonalDeckToOwnedTeamWorkspace(params: {
  deckId: number;
  teamId: number;
  subscriberUserId: string;
}): Promise<void> {
  const team = await getTeamById(params.teamId);
  if (!team) throw new Error("Team not found.");
  if (team.ownerUserId !== params.subscriberUserId) {
    throw new Error("Only the subscriber can attach personal decks.");
  }

  const deck = await getDeckRowById(params.deckId);
  if (!deck) throw new Error("Deck not found.");
  if (deck.userId !== team.ownerUserId) {
    throw new Error("Deck does not belong to this subscriber.");
  }

  const alreadyLinkedHere = await isDeckLinkedToWorkspace(params.teamId, params.deckId);
  if (alreadyLinkedHere && deck.teamId == null) {
    return;
  }

  try {
    if (deck.teamId != null) {
      const priorTeam = await getTeamById(deck.teamId);
      if (!priorTeam || priorTeam.ownerUserId !== deck.userId) {
        throw new Error("Deck is scoped to a workspace that is not owned by this subscriber.");
      }
      await db
        .insert(deckWorkspaceLinks)
        .values({ teamId: deck.teamId, deckId: deck.id })
        .onConflictDoNothing({
          target: [deckWorkspaceLinks.teamId, deckWorkspaceLinks.deckId],
        });
      await db
        .update(decks)
        .set({ teamId: null, updatedAt: new Date() })
        .where(and(eq(decks.id, deck.id), eq(decks.userId, deck.userId)));
    }

    await db
      .insert(deckWorkspaceLinks)
      .values({ teamId: params.teamId, deckId: params.deckId })
      .onConflictDoNothing({
        target: [deckWorkspaceLinks.teamId, deckWorkspaceLinks.deckId],
      });
  } catch (e) {
    if (isMissingDeckWorkspaceLinksTableError(e)) {
      throw new Error(
        "Linking decks to multiple workspaces requires migration `0022_deck_workspace_links`. Apply Drizzle migrations to your database, then try again.",
      );
    }
    throw e;
  }
}

let warnedMissingTeamQuizDurationColumn = false;
function warnMissingTeamQuizDurationColumnOnce() {
  if (warnedMissingTeamQuizDurationColumn) return;
  warnedMissingTeamQuizDurationColumn = true;
  console.warn(
    "[db] Column teams.quizDurationMinutes is missing. Apply migration 0028_team_quiz_duration_minutes.sql.",
  );
}

function isMissingTeamQuizDurationColumnError(error: unknown): boolean {
  if (error === null || error === undefined) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return /quizDurationMinutes|quiz_duration_minutes/i.test(msg);
}

function isMissingTeamOwnerQuizDefaultsError(error: unknown): boolean {
  if (error === null || error === undefined) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return /team_owner_quiz_defaults/i.test(msg);
}

function isMissingOwnerQuizEnforceColumnError(error: unknown): boolean {
  if (error === null || error === undefined) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return /enforce_default_for_all_workspaces|enforceDefaultForAllWorkspaces/i.test(msg);
}

const DEFAULT_OWNER_QUIZ_SETTINGS: OwnerQuizDefaultSettings = {
  defaultQuizDurationMinutes: DEFAULT_TEAM_QUIZ_DURATION_MINUTES,
  enforceDefaultForAllWorkspaces: false,
};

export async function getOwnerQuizDefaultSettings(
  ownerUserId: string,
): Promise<OwnerQuizDefaultSettings> {
  try {
    const [row] = await db
      .select()
      .from(teamOwnerQuizDefaults)
      .where(eq(teamOwnerQuizDefaults.ownerUserId, ownerUserId));
    if (!row) return DEFAULT_OWNER_QUIZ_SETTINGS;
    return {
      defaultQuizDurationMinutes: resolveTeamQuizDurationMinutes(
        row.defaultQuizDurationMinutes,
      ),
      enforceDefaultForAllWorkspaces: Boolean(row.enforceDefaultForAllWorkspaces),
    };
  } catch (e) {
    if (isMissingOwnerQuizEnforceColumnError(e)) {
      try {
        const [row] = await db
          .select({
            defaultQuizDurationMinutes: teamOwnerQuizDefaults.defaultQuizDurationMinutes,
          })
          .from(teamOwnerQuizDefaults)
          .where(eq(teamOwnerQuizDefaults.ownerUserId, ownerUserId));
        return {
          defaultQuizDurationMinutes: resolveTeamQuizDurationMinutes(
            row?.defaultQuizDurationMinutes,
          ),
          enforceDefaultForAllWorkspaces: false,
        };
      } catch {
        return DEFAULT_OWNER_QUIZ_SETTINGS;
      }
    }
    if (!isMissingTeamOwnerQuizDefaultsError(e)) throw e;
    return DEFAULT_OWNER_QUIZ_SETTINGS;
  }
}

export async function getOwnerQuizDefaultMinutes(ownerUserId: string): Promise<number> {
  const settings = await getOwnerQuizDefaultSettings(ownerUserId);
  return settings.defaultQuizDurationMinutes;
}

export async function clearWorkspaceQuizOverridesForOwner(
  ownerUserId: string,
): Promise<void> {
  try {
    await db
      .update(teams)
      .set({ quizDurationMinutes: null })
      .where(eq(teams.ownerUserId, ownerUserId));
  } catch (e) {
    if (!isMissingTeamQuizDurationColumnError(e)) throw e;
    warnMissingTeamQuizDurationColumnOnce();
  }
}

export async function updateOwnerQuizDefaultSettings(
  ownerUserId: string,
  input: OwnerQuizDefaultSettings,
): Promise<void> {
  const normalizedMinutes = resolveTeamQuizDurationMinutes(
    input.defaultQuizDurationMinutes,
  );
  try {
    await db
      .insert(teamOwnerQuizDefaults)
      .values({
        ownerUserId,
        defaultQuizDurationMinutes: normalizedMinutes,
        enforceDefaultForAllWorkspaces: input.enforceDefaultForAllWorkspaces,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: teamOwnerQuizDefaults.ownerUserId,
        set: {
          defaultQuizDurationMinutes: normalizedMinutes,
          enforceDefaultForAllWorkspaces: input.enforceDefaultForAllWorkspaces,
          updatedAt: new Date(),
        },
      });
    if (input.enforceDefaultForAllWorkspaces) {
      await clearWorkspaceQuizOverridesForOwner(ownerUserId);
    }
  } catch (e) {
    if (isMissingOwnerQuizEnforceColumnError(e)) {
      throw new Error(
        "Database is missing quiz enforce-default support. Run: npm run db:ensure-owner-quiz-enforce-column (or apply migration 0030_owner_quiz_enforce_default.sql).",
      );
    }
    if (!isMissingTeamOwnerQuizDefaultsError(e)) throw e;
    throw new Error(
      "Database is missing owner quiz default support. Apply migrations 0029_team_quiz_owner_defaults.sql and 0030_owner_quiz_enforce_default.sql.",
    );
  }
}

/** @deprecated Use {@link updateOwnerQuizDefaultSettings}. */
export async function updateOwnerQuizDefaultMinutes(
  ownerUserId: string,
  minutes: number,
): Promise<void> {
  const current = await getOwnerQuizDefaultSettings(ownerUserId);
  await updateOwnerQuizDefaultSettings(ownerUserId, {
    ...current,
    defaultQuizDurationMinutes: minutes,
  });
}

/** Quiz timer rows for team-admin UI — one per manageable workspace under the same subscriber. */
export async function listQuizTimerWorkspaceSnapshots(
  manageableTeams: InferSelectModel<typeof teams>[],
): Promise<QuizTimerWorkspaceSnapshot[]> {
  if (manageableTeams.length === 0) return [];

  const ownerUserId = manageableTeams[0]?.ownerUserId;
  const ownerSettings = ownerUserId
    ? await getOwnerQuizDefaultSettings(ownerUserId)
    : DEFAULT_OWNER_QUIZ_SETTINGS;
  const globalDefaultMinutes = ownerSettings.defaultQuizDurationMinutes;

  const snapshots = manageableTeams.map((team) => {
    const workspaceOverrideMinutes =
      team.quizDurationMinutes != null
        ? resolveTeamQuizDurationMinutes(team.quizDurationMinutes)
        : null;
    const effectiveMinutes = ownerSettings.enforceDefaultForAllWorkspaces
      ? globalDefaultMinutes
      : (workspaceOverrideMinutes ?? globalDefaultMinutes);
    return {
      id: team.id,
      name: team.name,
      workspaceOverrideMinutes,
      effectiveMinutes,
    };
  });

  return snapshots.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTeamQuizDurationContext(
  teamId: number,
): Promise<TeamQuizDurationContext | null> {
  try {
    const team = await getTeamById(teamId);
    if (!team) return null;
    const ownerSettings = await getOwnerQuizDefaultSettings(team.ownerUserId);
    const globalDefaultMinutes = ownerSettings.defaultQuizDurationMinutes;
    const workspaceOverrideMinutes =
      team.quizDurationMinutes != null
        ? resolveTeamQuizDurationMinutes(team.quizDurationMinutes)
        : null;
    const effectiveMinutes = ownerSettings.enforceDefaultForAllWorkspaces
      ? globalDefaultMinutes
      : (workspaceOverrideMinutes ?? globalDefaultMinutes);
    return {
      effectiveMinutes,
      globalDefaultMinutes,
      workspaceOverrideMinutes,
      enforceDefaultForAllWorkspaces: ownerSettings.enforceDefaultForAllWorkspaces,
      ownerUserId: team.ownerUserId,
    };
  } catch (e) {
    if (
      !isMissingTeamQuizDurationColumnError(e) &&
      !isMissingTeamOwnerQuizDefaultsError(e)
    ) {
      throw e;
    }
    warnMissingTeamQuizDurationColumnOnce();
    return {
      effectiveMinutes: DEFAULT_TEAM_QUIZ_DURATION_MINUTES,
      globalDefaultMinutes: DEFAULT_TEAM_QUIZ_DURATION_MINUTES,
      workspaceOverrideMinutes: null,
      enforceDefaultForAllWorkspaces: false,
      ownerUserId: "",
    };
  }
}

export async function getTeamQuizDurationMinutes(teamId: number): Promise<number> {
  const ctx = await getTeamQuizDurationContext(teamId);
  return ctx?.effectiveMinutes ?? DEFAULT_TEAM_QUIZ_DURATION_MINUTES;
}

export async function updateTeamQuizDurationMinutes(
  teamId: number,
  minutes: number | null,
): Promise<void> {
  try {
    if (minutes == null) {
      await db
        .update(teams)
        .set({ quizDurationMinutes: null })
        .where(eq(teams.id, teamId));
      return;
    }
    const normalized = resolveTeamQuizDurationMinutes(minutes);
    await db
      .update(teams)
      .set({ quizDurationMinutes: normalized })
      .where(eq(teams.id, teamId));
  } catch (e) {
    if (!isMissingTeamQuizDurationColumnError(e)) throw e;
    warnMissingTeamQuizDurationColumnOnce();
    throw new Error(
      "Database is missing quiz duration support. Apply migration 0028_team_quiz_duration_minutes.sql.",
    );
  }
}
