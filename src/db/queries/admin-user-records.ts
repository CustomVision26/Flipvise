import { db } from "@/db";
import {
  adminPlanAssignmentLogs,
  cards,
  deckWorkspaceLinks,
  decks,
  stripeSubscriptions,
  teamDeckAssignments,
  teamMembers,
  teams,
} from "@/db/schema";
import { listContentDeletionsForUser } from "@/db/queries/content-deletion-logs";
import { limitsForPlan } from "@/lib/team-plans";
import { receiptPlanTitleForSlug } from "@/lib/stripe-receipt-plan-title";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";

export type AdminDeckRecord = {
  id: number;
  name: string;
  cardCount: number;
  createdAt: string;
};

export type AdminAssignedDeckRecord = AdminDeckRecord & {
  assignedAt: string;
  memberUserId: string;
};

export type AdminInvitedWorkspaceRecord = {
  teamId: number;
  name: string;
  role: string;
  joinedAt: string;
  assignedDecks: AdminDeckRecord[];
};

export type AdminWorkspaceMemberRecord = {
  userId: string;
  role: string;
  deckLimit: number | null;
  joinedAt: string;
};

export type AdminOwnedWorkspaceRecord = {
  teamId: number;
  name: string;
  createdAt: string;
  deckLimit: number;
  members: AdminWorkspaceMemberRecord[];
  linkedDecks: AdminDeckRecord[];
  assignments: AdminAssignedDeckRecord[];
};

export type AdminPlanHistoryRecord = {
  id: string;
  planName: string;
  previousPlanName: string | null;
  detail: string | null;
  status: string;
  recordedAt: string;
};

export type AdminUserRecords = {
  personalDecks: AdminDeckRecord[];
  invitedWorkspaces: AdminInvitedWorkspaceRecord[];
  ownedWorkspaces: AdminOwnedWorkspaceRecord[];
  planHistory: AdminPlanHistoryRecord[];
  deletions: Awaited<ReturnType<typeof listContentDeletionsForUser>>;
};

function iso(value: Date | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  return value.toISOString();
}

function roleLabel(role: string): string {
  if (role === "team_admin") return "Team admin";
  if (role === "team_member") return "Member";
  return role;
}

async function cardCountsFor(deckIds: number[]): Promise<Map<number, number>> {
  const unique = [...new Set(deckIds)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ deckId: cards.deckId, cardCount: count() })
    .from(cards)
    .where(inArray(cards.deckId, unique))
    .groupBy(cards.deckId);
  return new Map(rows.map((row) => [row.deckId, Number(row.cardCount)]));
}

export async function getAdminUserRecords(userId: string): Promise<AdminUserRecords> {
  const personalRows = await db
    .select({
      id: decks.id,
      name: decks.name,
      createdAt: decks.createdAt,
    })
    .from(decks)
    .where(and(eq(decks.userId, userId), isNull(decks.teamId)))
    .orderBy(desc(decks.createdAt));

  const memberships = await db
    .select({
      teamId: teamMembers.teamId,
      role: teamMembers.role,
      joinedAt: teamMembers.createdAt,
      teamName: teams.name,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, userId));

  const owned = await db
    .select({
      id: teams.id,
      name: teams.name,
      planSlug: teams.planSlug,
      createdAt: teams.createdAt,
    })
    .from(teams)
    .where(eq(teams.ownerUserId, userId))
    .orderBy(desc(teams.createdAt));

  const ownedIds = owned.map((team) => team.id);
  const invitedIds = memberships.map((row) => row.teamId);
  const teamIds = [...new Set([...ownedIds, ...invitedIds])];

  const assignmentRows =
    teamIds.length === 0
      ? []
      : await db
          .select({
            teamId: teamDeckAssignments.teamId,
            deckId: teamDeckAssignments.deckId,
            memberUserId: teamDeckAssignments.memberUserId,
            assignedAt: teamDeckAssignments.createdAt,
          })
          .from(teamDeckAssignments)
          .where(inArray(teamDeckAssignments.teamId, teamIds));

  const linkRows =
    ownedIds.length === 0
      ? []
      : await db
          .select({
            teamId: deckWorkspaceLinks.teamId,
            deckId: deckWorkspaceLinks.deckId,
            linkedAt: deckWorkspaceLinks.createdAt,
          })
          .from(deckWorkspaceLinks)
          .where(inArray(deckWorkspaceLinks.teamId, ownedIds));

  const nativeRows =
    ownedIds.length === 0
      ? []
      : await db
          .select({
            teamId: decks.teamId,
            deckId: decks.id,
            linkedAt: decks.createdAt,
          })
          .from(decks)
          .where(inArray(decks.teamId, ownedIds));

  const memberRows =
    ownedIds.length === 0
      ? []
      : await db
          .select({
            teamId: teamMembers.teamId,
            userId: teamMembers.userId,
            role: teamMembers.role,
            joinedAt: teamMembers.createdAt,
            maxCreateDecks: teamMembers.maxCreateDecks,
          })
          .from(teamMembers)
          .where(inArray(teamMembers.teamId, ownedIds));

  const deckIds = [
    ...personalRows.map((deck) => deck.id),
    ...assignmentRows.map((row) => row.deckId),
    ...linkRows.map((row) => row.deckId),
    ...nativeRows.map((row) => row.deckId),
  ];
  const counts = await cardCountsFor(deckIds);
  const uniqueDeckIds = [...new Set(deckIds)];
  const deckRows =
    uniqueDeckIds.length === 0
      ? []
      : await db
          .select({ id: decks.id, name: decks.name, createdAt: decks.createdAt })
          .from(decks)
          .where(inArray(decks.id, uniqueDeckIds));
  const deckById = new Map(deckRows.map((deck) => [deck.id, deck]));

  const toDeck = (id: number, createdAt: Date): AdminDeckRecord | null => {
    const deck = deckById.get(id);
    if (!deck) return null;
    return {
      id,
      name: deck.name,
      cardCount: counts.get(id) ?? 0,
      createdAt: iso(createdAt),
    };
  };

  const personalDecks: AdminDeckRecord[] = personalRows.map((deck) => ({
    id: deck.id,
    name: deck.name,
    cardCount: counts.get(deck.id) ?? 0,
    createdAt: iso(deck.createdAt),
  }));

  const invitedWorkspaces: AdminInvitedWorkspaceRecord[] = memberships.map((membership) => ({
    teamId: membership.teamId,
    name: membership.teamName,
    role: roleLabel(membership.role),
    joinedAt: iso(membership.joinedAt),
    assignedDecks: assignmentRows
      .filter((row) => row.teamId === membership.teamId && row.memberUserId === userId)
      .map((row) => toDeck(row.deckId, row.assignedAt))
      .filter((deck): deck is AdminDeckRecord => deck != null),
  }));

  const ownedWorkspaces: AdminOwnedWorkspaceRecord[] = owned.map((team) => {
    const planLimit = limitsForPlan(team.planSlug).maxDecksPerWorkspace;
    const linked = new Map<number, Date>();
    for (const row of linkRows) {
      if (row.teamId === team.id) linked.set(row.deckId, row.linkedAt);
    }
    for (const row of nativeRows) {
      if (row.teamId === team.id && !linked.has(row.deckId)) {
        linked.set(row.deckId, row.linkedAt);
      }
    }
    return {
      teamId: team.id,
      name: team.name,
      createdAt: iso(team.createdAt),
      deckLimit: planLimit,
      members: memberRows
        .filter((member) => member.teamId === team.id)
        .map((member) => ({
          userId: member.userId,
          role: roleLabel(member.role),
          deckLimit: member.role === "team_admin" ? (member.maxCreateDecks ?? planLimit) : null,
          joinedAt: iso(member.joinedAt),
        })),
      linkedDecks: [...linked.entries()]
        .map(([deckId, createdAt]) => toDeck(deckId, createdAt))
        .filter((deck): deck is AdminDeckRecord => deck != null),
      assignments: assignmentRows
        .filter((row) => row.teamId === team.id)
        .map((row) => {
          const deck = toDeck(row.deckId, row.assignedAt);
          if (!deck) return null;
          return { ...deck, assignedAt: iso(row.assignedAt), memberUserId: row.memberUserId };
        })
        .filter((row): row is AdminAssignedDeckRecord => row != null),
    };
  });

  const planLogs = await db
    .select({
      id: adminPlanAssignmentLogs.id,
      action: adminPlanAssignmentLogs.action,
      planName: adminPlanAssignmentLogs.planName,
      previousPlanName: adminPlanAssignmentLogs.previousPlanName,
      createdAt: adminPlanAssignmentLogs.createdAt,
    })
    .from(adminPlanAssignmentLogs)
    .where(eq(adminPlanAssignmentLogs.targetUserId, userId))
    .orderBy(desc(adminPlanAssignmentLogs.createdAt))
    .limit(100);

  const [subscription] = await db
    .select({
      planSlug: stripeSubscriptions.planSlug,
      status: stripeSubscriptions.status,
      updatedAt: stripeSubscriptions.updatedAt,
      currentPeriodEnd: stripeSubscriptions.currentPeriodEnd,
    })
    .from(stripeSubscriptions)
    .where(eq(stripeSubscriptions.userId, userId))
    .limit(1);

  const planHistory: AdminPlanHistoryRecord[] = planLogs
    .filter((row) => row.action === "plan_assigned" || row.action === "plan_removed")
    .map((row) => ({
      id: `assign-${row.id}`,
      planName: row.planName ?? "Free",
      previousPlanName: row.previousPlanName,
      detail: null,
      status: row.action === "plan_removed" ? "Removed" : "Assigned",
      recordedAt: iso(row.createdAt),
    }));

  if (subscription) {
    planHistory.unshift({
      id: "stripe-current",
      planName: receiptPlanTitleForSlug(subscription.planSlug),
      previousPlanName: null,
      detail: subscription.currentPeriodEnd
        ? `Period ends ${subscription.currentPeriodEnd.toISOString()}`
        : null,
      status: subscription.status,
      recordedAt: iso(subscription.updatedAt),
    });
  }

  const deletions = await listContentDeletionsForUser(userId);

  return {
    personalDecks,
    invitedWorkspaces,
    ownedWorkspaces,
    planHistory,
    deletions,
  };
}
