import { db } from "@/db";
import {
  adminPrivilegeLogs,
  cards,
  decks,
  teamDeckAssignments,
  teamInvitations,
  teamMembers,
  teams,
} from "@/db/schema";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { TEAM_PLAN_LABELS, isTeamPlanId, type TeamPlanId } from "@/lib/team-plans";

function teamPlanLabelForAdmin(slug: string): string {
  return isTeamPlanId(slug) ? TEAM_PLAN_LABELS[slug as TeamPlanId] : slug;
}

export async function getAdminOverviewStats() {
  const [deckStats] = await db
    .select({ totalDecks: count(decks.id) })
    .from(decks);

  const [cardStats] = await db
    .select({ totalCards: count(cards.id) })
    .from(cards);

  return {
    totalDecks: deckStats?.totalDecks ?? 0,
    totalCards: cardStats?.totalCards ?? 0,
  };
}

export async function getDeckStatsByUser(): Promise<
  {
    userId: string;
    deckCount: number;
    cardCount: number;
    lastUpdated: Date | null;
  }[]
> {
  const rows = await db
    .select({
      userId: decks.userId,
      deckCount: count(decks.id),
      cardCount: sql<number>`cast(count(${cards.id}) as integer)`,
      // PostgreSQL GREATEST ignores NULLs, so if a user has no cards the deck
      // updatedAt is returned as the fallback.
      lastUpdated: sql<Date | null>`GREATEST(MAX(${decks.updatedAt}), MAX(${cards.updatedAt}))`,
    })
    .from(decks)
    .leftJoin(cards, eq(cards.deckId, decks.id))
    .groupBy(decks.userId);

  return rows.map((r) => ({
    userId: r.userId,
    deckCount: r.deckCount,
    cardCount: Number(r.cardCount),
    lastUpdated: r.lastUpdated ? new Date(r.lastUpdated) : null,
  }));
}

/**
 * Display label(s) for `teams.plan_slug` where the user is the workspace owner. Used
 * when Clerk public metadata is missing the billing plan id but the app DB is up to date.
 */
export async function getTeamOwnerPlanLabelsByUserIds(
  userIds: string[],
): Promise<Map<string, string | null>> {
  if (userIds.length === 0) return new Map();

  let rows: { ownerUserId: string; planSlug: string }[] = [];
  try {
    rows = await db
      .select({ ownerUserId: teams.ownerUserId, planSlug: teams.planSlug })
      .from(teams)
      .where(inArray(teams.ownerUserId, userIds));
  } catch {
    const fallback = new Map<string, string | null>();
    for (const id of userIds) {
      fallback.set(id, null);
    }
    return fallback;
  }

  const byUser = new Map<string, Set<string>>();
  for (const id of userIds) {
    byUser.set(id, new Set());
  }
  for (const r of rows) {
    byUser.get(r.ownerUserId)?.add(r.planSlug);
  }

  const out = new Map<string, string | null>();
  for (const id of userIds) {
    const set = byUser.get(id)!;
    if (set.size === 0) {
      out.set(id, null);
    } else {
      out.set(
        id,
        Array.from(set)
          .map(teamPlanLabelForAdmin)
          .sort((a, b) => a.localeCompare(b))
          .join(", "),
      );
    }
  }
  return out;
}

/**
 * Raw team `plan_slug` values for workspaces owned by each user.
 * Useful when Clerk metadata is missing but DB ownership is authoritative.
 */
export async function getTeamOwnerPlanSlugsByUserIds(
  userIds: string[],
): Promise<Map<string, string[]>> {
  if (userIds.length === 0) return new Map();

  const out = new Map<string, string[]>();
  for (const id of userIds) {
    out.set(id, []);
  }
  let rows: { ownerUserId: string; planSlug: string }[] = [];
  try {
    rows = await db
      .select({ ownerUserId: teams.ownerUserId, planSlug: teams.planSlug })
      .from(teams)
      .where(inArray(teams.ownerUserId, userIds));
  } catch {
    return out;
  }

  for (const row of rows) {
    const current = out.get(row.ownerUserId) ?? [];
    if (!current.includes(row.planSlug)) current.push(row.planSlug);
    out.set(row.ownerUserId, current);
  }

  return out;
}

export type UserTeamPlanAdminRow = {
  label: string | null;
  /** True when the user is a team owner or `team_member` (not from a pending-only email invite). */
  hasActiveTeamAccess: boolean;
};

/**
 * **Associate plan (label):** workspace `plan_slug` for teams the user was **invited to
 * with an invitation in `accepted` status** (matched on primary email).
 *
 * **hasActiveTeamAccess:** `true` if the user is a team owner or active `team_member` —
 * used for admin “Plan = Pro” when combined with other signals (independent of label).
 */
export async function getUserTeamPlanAssociationsByUserIds(
  userIds: string[],
  /** Admin serializes every row’s `userId` + primary email so we can match `team_invitations.email`. */
  userIdPrimaryEmailPairs?: { userId: string; email: string | null }[],
): Promise<Map<string, UserTeamPlanAdminRow>> {
  if (userIds.length === 0) return new Map();

  const asOwner = await db
    .select({ userId: teams.ownerUserId })
    .from(teams)
    .where(inArray(teams.ownerUserId, userIds));

  const asMember = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(inArray(teamMembers.userId, userIds));

  const hasActiveTeamAccess = new Map<string, boolean>();
  for (const id of userIds) {
    hasActiveTeamAccess.set(id, false);
  }
  for (const row of asOwner) {
    hasActiveTeamAccess.set(row.userId, true);
  }
  for (const row of asMember) {
    hasActiveTeamAccess.set(row.userId, true);
  }

  const labelSlugsByUser = new Map<string, Set<string>>();
  for (const id of userIds) {
    labelSlugsByUser.set(id, new Set());
  }

  if (userIdPrimaryEmailPairs?.length) {
    const emailLower = userIdPrimaryEmailPairs
      .map((p) => p.email?.toLowerCase())
      .filter((e): e is string => Boolean(e));
    const unique = [...new Set(emailLower)];
    if (unique.length) {
      const acceptedRows = await db
        .select({ email: teamInvitations.email, planSlug: teams.planSlug })
        .from(teamInvitations)
        .innerJoin(teams, eq(teams.id, teamInvitations.teamId))
        .where(
          and(
            eq(teamInvitations.status, "accepted"),
            inArray(sql`lower(${teamInvitations.email})`, unique),
          ),
        );
      const emailToSlugs = new Map<string, Set<string>>();
      for (const row of acceptedRows) {
        const k = row.email.toLowerCase();
        if (!emailToSlugs.has(k)) {
          emailToSlugs.set(k, new Set());
        }
        emailToSlugs.get(k)!.add(row.planSlug);
      }
      for (const p of userIdPrimaryEmailPairs) {
        if (!p.email) continue;
        const sl = emailToSlugs.get(p.email.toLowerCase());
        if (sl) {
          const set = labelSlugsByUser.get(p.userId);
          if (set) {
            for (const s of sl) {
              set.add(s);
            }
          }
        }
      }
    }
  }

  const out = new Map<string, UserTeamPlanAdminRow>();
  for (const id of userIds) {
    const set = labelSlugsByUser.get(id)!;
    if (set.size === 0) {
      out.set(id, { label: null, hasActiveTeamAccess: hasActiveTeamAccess.get(id) ?? false });
    } else {
      const label = Array.from(set)
        .map(teamPlanLabelForAdmin)
        .sort((a, b) => a.localeCompare(b))
        .join(", ");
      out.set(id, { label, hasActiveTeamAccess: hasActiveTeamAccess.get(id) ?? false });
    }
  }
  return out;
}

export async function getAdminPrivilegeLogs(limit = 100) {
  return db
    .select()
    .from(adminPrivilegeLogs)
    .orderBy(desc(adminPrivilegeLogs.createdAt))
    .limit(limit);
}

export async function getTeamWorkspaceCountsByOwnerUserIds(
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();

  const rows = await db
    .select({
      ownerUserId: teams.ownerUserId,
      workspaceCount: count(teams.id),
    })
    .from(teams)
    .where(inArray(teams.ownerUserId, userIds))
    .groupBy(teams.ownerUserId);

  const out = new Map<string, number>();
  for (const id of userIds) {
    out.set(id, 0);
  }
  for (const row of rows) {
    out.set(row.ownerUserId, Number(row.workspaceCount ?? 0));
  }
  return out;
}

export async function getTeamInviteeTotalsByOwnerUserIds(
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();

  const memberRows = await db
    .select({
      ownerUserId: teams.ownerUserId,
      total: count(teamMembers.id),
    })
    .from(teams)
    .leftJoin(teamMembers, eq(teamMembers.teamId, teams.id))
    .where(inArray(teams.ownerUserId, userIds))
    .groupBy(teams.ownerUserId);

  const pendingInviteRows = await db
    .select({
      ownerUserId: teams.ownerUserId,
      total: count(teamInvitations.id),
    })
    .from(teams)
    .leftJoin(
      teamInvitations,
      and(eq(teamInvitations.teamId, teams.id), eq(teamInvitations.status, "pending")),
    )
    .where(inArray(teams.ownerUserId, userIds))
    .groupBy(teams.ownerUserId);

  const out = new Map<string, number>();
  for (const id of userIds) {
    out.set(id, 0);
  }
  for (const row of memberRows) {
    out.set(row.ownerUserId, Number(row.total ?? 0));
  }
  for (const row of pendingInviteRows) {
    out.set(row.ownerUserId, (out.get(row.ownerUserId) ?? 0) + Number(row.total ?? 0));
  }
  return out;
}

export type AdminWorkspaceDetailsRow = {
  ownerUserId: string;
  teamId: number;
  teamName: string;
  planSlug: string;
  inviteeTotal: number;
  inviteeAdminTotal: number;
  inviteeMemberTotal: number;
  deckTotal: number;
  cardTotal: number;
  invitees: {
    userId: string | null;
    email: string | null;
    role: "team_admin" | "team_member";
    membershipStatus: "active" | "pending";
    assignedDeckNames: string[];
  }[];
};

export async function getWorkspaceDetailsByOwnerUserIds(
  userIds: string[],
): Promise<Map<string, AdminWorkspaceDetailsRow[]>> {
  if (userIds.length === 0) return new Map();

  const out = new Map<string, AdminWorkspaceDetailsRow[]>();
  for (const userId of userIds) {
    out.set(userId, []);
  }
  let workspaceRows: {
    ownerUserId: string;
    teamId: number;
    teamName: string;
    planSlug: string;
  }[] = [];
  try {
    workspaceRows = await db
      .select({
        ownerUserId: teams.ownerUserId,
        teamId: teams.id,
        teamName: teams.name,
        planSlug: teams.planSlug,
      })
      .from(teams)
      .where(inArray(teams.ownerUserId, userIds));
  } catch {
    return out;
  }
  if (workspaceRows.length === 0) return out;

  const teamIds = workspaceRows.map((row) => row.teamId);

  const memberRows = await db
    .select({
      teamId: teamMembers.teamId,
      role: teamMembers.role,
      total: count(teamMembers.id),
    })
    .from(teamMembers)
    .where(inArray(teamMembers.teamId, teamIds))
    .groupBy(teamMembers.teamId, teamMembers.role);

  const pendingInviteRows = await db
    .select({
      teamId: teamInvitations.teamId,
      role: teamInvitations.role,
      total: count(teamInvitations.id),
    })
    .from(teamInvitations)
    .where(
      and(
        inArray(teamInvitations.teamId, teamIds),
        eq(teamInvitations.status, "pending"),
      ),
    )
    .groupBy(teamInvitations.teamId, teamInvitations.role);

  const deckCardRows = await db
    .select({
      teamId: decks.teamId,
      deckTotal: count(sql`distinct ${decks.id}`),
      cardTotal: count(cards.id),
    })
    .from(decks)
    .leftJoin(cards, eq(cards.deckId, decks.id))
    .where(inArray(decks.teamId, teamIds))
    .groupBy(decks.teamId);

  const memberInviteeRows = await db
    .select({
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .where(inArray(teamMembers.teamId, teamIds));

  const pendingInviteeRows = await db
    .select({
      teamId: teamInvitations.teamId,
      email: teamInvitations.email,
      role: teamInvitations.role,
    })
    .from(teamInvitations)
    .where(
      and(
        inArray(teamInvitations.teamId, teamIds),
        eq(teamInvitations.status, "pending"),
      ),
    );

  const assignedDeckRows = await db
    .select({
      teamId: teamDeckAssignments.teamId,
      memberUserId: teamDeckAssignments.memberUserId,
      deckName: decks.name,
    })
    .from(teamDeckAssignments)
    .innerJoin(decks, eq(decks.id, teamDeckAssignments.deckId))
    .where(inArray(teamDeckAssignments.teamId, teamIds));

  const inviteeRoleCountsByTeamId = new Map<
    number,
    { admin: number; member: number }
  >();
  const ensureInviteeCounts = (teamId: number) => {
    const existing = inviteeRoleCountsByTeamId.get(teamId);
    if (existing) return existing;
    const initial = { admin: 0, member: 0 };
    inviteeRoleCountsByTeamId.set(teamId, initial);
    return initial;
  };
  for (const row of memberRows) {
    const bucket = ensureInviteeCounts(row.teamId);
    if (row.role === "team_admin") bucket.admin += Number(row.total ?? 0);
    if (row.role === "team_member") bucket.member += Number(row.total ?? 0);
  }
  for (const row of pendingInviteRows) {
    const bucket = ensureInviteeCounts(row.teamId);
    if (row.role === "team_admin") bucket.admin += Number(row.total ?? 0);
    if (row.role === "team_member") bucket.member += Number(row.total ?? 0);
  }

  const deckCardByTeamId = new Map<number, { deckTotal: number; cardTotal: number }>();
  for (const row of deckCardRows) {
    if (row.teamId == null) continue;
    deckCardByTeamId.set(Number(row.teamId), {
      deckTotal: Number(row.deckTotal ?? 0),
      cardTotal: Number(row.cardTotal ?? 0),
    });
  }

  const assignedDeckNamesByTeamAndUser = new Map<string, Set<string>>();
  for (const row of assignedDeckRows) {
    const key = `${row.teamId}:${row.memberUserId}`;
    const current = assignedDeckNamesByTeamAndUser.get(key) ?? new Set<string>();
    current.add(row.deckName);
    assignedDeckNamesByTeamAndUser.set(key, current);
  }

  const inviteesByTeamId = new Map<
    number,
    {
      userId: string | null;
      email: string | null;
      role: "team_admin" | "team_member";
      membershipStatus: "active" | "pending";
      assignedDeckNames: string[];
    }[]
  >();
  for (const row of memberInviteeRows) {
    const key = `${row.teamId}:${row.userId}`;
    const assignedDeckNames = Array.from(assignedDeckNamesByTeamAndUser.get(key) ?? []);
    const current = inviteesByTeamId.get(row.teamId) ?? [];
    current.push({
      userId: row.userId,
      email: null,
      role: row.role,
      membershipStatus: "active",
      assignedDeckNames: assignedDeckNames.sort((a, b) => a.localeCompare(b)),
    });
    inviteesByTeamId.set(row.teamId, current);
  }
  for (const row of pendingInviteeRows) {
    const current = inviteesByTeamId.get(row.teamId) ?? [];
    current.push({
      userId: null,
      email: row.email,
      role: row.role,
      membershipStatus: "pending",
      assignedDeckNames: [],
    });
    inviteesByTeamId.set(row.teamId, current);
  }

  for (const workspace of workspaceRows) {
    const inviteeRoleCounts = inviteeRoleCountsByTeamId.get(workspace.teamId) ?? {
      admin: 0,
      member: 0,
    };
    const deckCard = deckCardByTeamId.get(workspace.teamId) ?? { deckTotal: 0, cardTotal: 0 };
    const row: AdminWorkspaceDetailsRow = {
      ownerUserId: workspace.ownerUserId,
      teamId: workspace.teamId,
      teamName: workspace.teamName,
      planSlug: workspace.planSlug,
      inviteeTotal: inviteeRoleCounts.admin + inviteeRoleCounts.member,
      inviteeAdminTotal: inviteeRoleCounts.admin,
      inviteeMemberTotal: inviteeRoleCounts.member,
      deckTotal: deckCard.deckTotal,
      cardTotal: deckCard.cardTotal,
      invitees: (inviteesByTeamId.get(workspace.teamId) ?? []).sort((a, b) => {
        const roleDiff =
          (a.role === "team_admin" ? 0 : 1) - (b.role === "team_admin" ? 0 : 1);
        if (roleDiff !== 0) return roleDiff;
        const left = (a.email ?? a.userId ?? "").toLowerCase();
        const right = (b.email ?? b.userId ?? "").toLowerCase();
        return left.localeCompare(right);
      }),
    };
    const current = out.get(workspace.ownerUserId) ?? [];
    current.push(row);
    out.set(workspace.ownerUserId, current);
  }

  for (const [ownerUserId, rows] of out.entries()) {
    rows.sort((a, b) => a.teamName.localeCompare(b.teamName));
    out.set(ownerUserId, rows);
  }

  return out;
}

export type AdminPrivilegeLogAction =
  | "granted"
  | "revoked"
  | "superadmin_granted"
  | "superadmin_revoked";

export async function logAdminPrivilegeChange(data: {
  targetUserId: string;
  targetUserName: string;
  grantedByUserId: string;
  grantedByName: string;
  action: AdminPrivilegeLogAction;
}) {
  return db.insert(adminPrivilegeLogs).values(data);
}
