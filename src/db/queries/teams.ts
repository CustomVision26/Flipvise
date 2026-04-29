import { db } from "@/db";
import {
  cards,
  decks,
  teamDeckAssignments,
  teamInvitations,
  teamMembers,
  teams,
} from "@/db/schema";
import {
  deckRowSelectWithoutCover,
  getDeckRowById,
  isMissingDeckCoverColumnError,
  type DeckRow,
} from "@/db/queries/decks";
import { isTeamPlanId, TEAM_PLAN_LABELS, type TeamPlanId } from "@/lib/team-plans";
import { getClerkUserDisplayNameById } from "@/lib/clerk-user-display";
import type { TeamWorkspaceNavTeam } from "@/lib/team-workspace-url";
import { FREE_PERSONAL_WORKSPACE_NAV_TEAM_LIMIT } from "@/lib/workspace-nav-limits";
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  inArray,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type TeamMemberRow = InferSelectModel<typeof teamMembers>;

export type TeamMemberRole = "team_admin" | "team_member";

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

export async function getTeamsByOwner(ownerUserId: string) {
  return db.select().from(teams).where(eq(teams.ownerUserId, ownerUserId));
}

export async function getTeamById(teamId: number) {
  const rows = await db.select().from(teams).where(eq(teams.id, teamId));
  return rows[0] ?? null;
}

export async function getTeamsByIds(ids: number[]) {
  if (ids.length === 0) return [];
  return db.select().from(teams).where(inArray(teams.id, ids));
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
  return db
    .select()
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.teamId, teamId),
        eq(teamInvitations.status, "pending"),
        gt(teamInvitations.expiresAt, now),
      ),
    )
    .orderBy(desc(teamInvitations.createdAt));
}

/** Past invitations for this team: terminal statuses, or pending but already expired. */
export async function listTeamInvitationHistoryForTeam(teamId: number) {
  const now = new Date();
  return db
    .select()
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.teamId, teamId),
        or(
          ne(teamInvitations.status, "pending"),
          and(eq(teamInvitations.status, "pending"), lte(teamInvitations.expiresAt, now)),
        ),
      ),
    )
    .orderBy(desc(teamInvitations.createdAt));
}

/** Pending invite for this workspace and email that has not yet expired. */
export async function getActivePendingInvitationForTeamEmail(teamId: number, email: string) {
  const normalized = email.toLowerCase();
  const now = new Date();
  const rows = await db
    .select()
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.teamId, teamId),
        eq(teamInvitations.email, normalized),
        eq(teamInvitations.status, "pending"),
        gt(teamInvitations.expiresAt, now),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getDecksForTeam(
  teamId: number,
  ownerUserId: string,
): Promise<DeckRow[]> {
  try {
    return await db
      .select()
      .from(decks)
      .where(and(eq(decks.teamId, teamId), eq(decks.userId, ownerUserId)));
  } catch (e) {
    if (!isMissingDeckCoverColumnError(e)) throw e;
    const rows = await db
      .select(deckRowSelectWithoutCover)
      .from(decks)
      .where(and(eq(decks.teamId, teamId), eq(decks.userId, ownerUserId)));
    return rows.map((r) => ({ ...r, coverImageUrl: null }));
  }
}

export async function getDecksForTeamWithCardCount(
  teamId: number,
  ownerUserId: string,
) {
  return db
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
    .where(and(eq(decks.teamId, teamId), eq(decks.userId, ownerUserId)))
    .groupBy(
      decks.id,
      decks.userId,
      decks.name,
      decks.description,
      decks.coverImageUrl,
      decks.createdAt,
      decks.updatedAt,
    );
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
    return rows.map((r) => ({ ...r, coverImageUrl: null }));
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

export async function resolveDeckViewerAccess(
  deckId: number,
  viewerUserId: string,
): Promise<DeckViewerAccess | null> {
  const deck = await getDeckRowById(deckId);
  if (!deck) return null;

  if (deck.userId === viewerUserId) {
    return { kind: "owner" };
  }

  if (!deck.teamId) {
    return null;
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

    return { kind: "team_member", teamId: deck.teamId };
  } catch {
    return null;
  }
}

/** Teams the user owns or manages as `team_admin` (for `/dashboard/team-admin`). */
export async function getTeamsForTeamDashboard(userId: string) {
  const owned = await getTeamsByOwner(userId);
  const adminRows = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(and(eq(teamMembers.userId, userId), eq(teamMembers.role, "team_admin")));
  const ids = [...new Set(adminRows.map((r) => r.teamId))].filter(Boolean);
  const extra =
    ids.length > 0
      ? await db.select().from(teams).where(inArray(teams.id, ids))
      : [];
  const map = new Map<number, InferSelectModel<typeof teams>>();
  for (const t of [...owned, ...extra]) {
    map.set(t.id, t);
  }
  return [...map.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * Team-tier workspaces shown in the header switcher — aligned with `/dashboard/team-admin`:
 * - **Subscriber owners** see every team workspace they own, plus any `team_member` workspaces (study).
 * - **Invited co-admins** who do **not** own a team-tier workspace see **only** `team_admin` teams — not
 *   `team_member`-only rows on other workspaces from the same subscriber (stale or accidental invites).
 * - **Pure team members** (no ownership, no `team_admin`) see each `team_member` workspace for study.
 */
export async function getEligibleWorkspaceTeamsForUser(userId: string) {
  const manageTeams = await getTeamsForTeamDashboard(userId);
  const memberships = await getTeamMembershipsForUser(userId);

  const ownsTeamTierWorkspace = manageTeams.some(
    (t) => t.ownerUserId === userId && isTeamPlanId(t.planSlug),
  );
  const hasTeamAdminMembership = memberships.some((m) => m.role === "team_admin");
  const isNonOwnerCoAdmin = !ownsTeamTierWorkspace && hasTeamAdminMembership;

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
  if (!isNonOwnerCoAdmin) {
    for (const t of memberOnlyTeams) {
      if (isTeamPlanId(t.planSlug)) map.set(t.id, t);
    }
  }

  return [...map.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

function planLabelForTeam(planSlug: string): string {
  return isTeamPlanId(planSlug) ? TEAM_PLAN_LABELS[planSlug as TeamPlanId] : planSlug;
}

export type WorkspaceNavTeamsResult = {
  /** Teams the user may select (limited for free personal accounts). */
  teams: TeamWorkspaceNavTeam[];
  /** All team-tier workspaces eligible for the switcher (owner / co-admin / member-only rows). */
  totalEligibleCount: number;
};

/**
 * Header workspace switcher: owner uses `teamMemberUrlParam` 0; invited users use `team_members.id`.
 * Eligible teams match {@link getEligibleWorkspaceTeamsForUser} (owners: all owned; co-admins: managed
 * teams only; members: assigned workspaces). Personal Pro (or admin unlock) lists every eligible team;
 * Free personal shows at most {@link FREE_PERSONAL_WORKSPACE_NAV_TEAM_LIMIT} (oldest first).
 */
export async function getWorkspaceNavTeamsForUser(
  userId: string,
  options: { personalProUnlocked: boolean },
): Promise<WorkspaceNavTeamsResult> {
  const eligible = await getEligibleWorkspaceTeamsForUser(userId);
  const totalEligibleCount = eligible.length;
  const memberships = await getTeamMembershipsForUser(userId);
  const membershipByTeamId = new Map(
    memberships.map((m) => [m.teamId, m] as const),
  );

  const ownerIds = [...new Set(eligible.map((t) => t.ownerUserId))];
  const ownerDisplayNameById = new Map<string, string>();
  await Promise.all(
    ownerIds.map(async (oid) => {
      ownerDisplayNameById.set(oid, await getClerkUserDisplayNameById(oid));
    }),
  );

  const full = eligible.map((t) => {
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
      planUrlValue: isTeamPlanId(t.planSlug) ? t.planSlug : "pro",
      ownerDisplayName: ownerDisplayNameById.get(t.ownerUserId) ?? "Subscriber",
      canAccessTeamAdmin,
      isSubscriberOwned: t.ownerUserId === userId,
    };
  });

  const teams = options.personalProUnlocked
    ? full
    : full.slice(0, FREE_PERSONAL_WORKSPACE_NAV_TEAM_LIMIT);

  return { teams, totalEligibleCount };
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
  const rows = await db
    .select()
    .from(teamInvitations)
    .where(eq(teamInvitations.token, token));
  return rows[0] ?? null;
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
) {
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
  return db
    .select({
      invitation: teamInvitations,
      team: teams,
    })
    .from(teamInvitations)
    .innerJoin(teams, eq(teamInvitations.teamId, teams.id))
    .where(eq(teamInvitations.email, normalized))
    .orderBy(desc(teamInvitations.createdAt));
}

export async function getTeamInvitationRowForInviteeEmail(
  invitationId: number,
  inviteeEmail: string,
) {
  const normalized = inviteeEmail.toLowerCase();
  const rows = await db
    .select()
    .from(teamInvitations)
    .where(
      and(
        eq(teamInvitations.id, invitationId),
        eq(teamInvitations.email, normalized),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listAssignmentsForTeam(teamId: number) {
  return db
    .select()
    .from(teamDeckAssignments)
    .where(eq(teamDeckAssignments.teamId, teamId));
}

export async function insertDeckAssignment(
  teamId: number,
  deckId: number,
  memberUserId: string,
) {
  await db
    .insert(teamDeckAssignments)
    .values({ teamId, deckId, memberUserId })
    .onConflictDoNothing();
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
 * Moves a team-scoped deck to another workspace owned by the same subscriber.
 * Clears all member assignments for that deck (re-assign on the destination workspace).
 */
export async function transferTeamDeckBetweenWorkspaces(params: {
  deckId: number;
  fromTeamId: number;
  toTeamId: number;
}) {
  const { deckId, fromTeamId, toTeamId } = params;
  if (fromTeamId === toTeamId) return;

  const fromTeam = await getTeamById(fromTeamId);
  const toTeam = await getTeamById(toTeamId);
  if (!fromTeam || !toTeam) throw new Error("Team not found.");
  if (fromTeam.ownerUserId !== toTeam.ownerUserId) {
    throw new Error(
      "Decks can only be moved between workspaces owned by the same subscriber.",
    );
  }

  const deck = await getDeckRowById(deckId);
  if (!deck || deck.teamId !== fromTeamId || deck.userId !== fromTeam.ownerUserId) {
    throw new Error("Deck not found in the source workspace.");
  }

  await db.transaction(async (tx) => {
    await tx.delete(teamDeckAssignments).where(eq(teamDeckAssignments.deckId, deckId));
    await tx
      .update(decks)
      .set({ teamId: toTeamId, updatedAt: new Date() })
      .where(and(eq(decks.id, deckId), eq(decks.teamId, fromTeamId)));
  });
}
