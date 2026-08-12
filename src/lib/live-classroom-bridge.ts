import "server-only";

import { auth } from "@/lib/clerk-auth";
import {
  accessHasAddon,
  getAccessContext,
  type AccessContext,
} from "@/lib/access";
import { LIVE_CLASSROOM_ADDON_KEY } from "@/lib/addon-keys";
import {
  getAssignedDecksForMemberWithCardCount,
  getDecksForTeamWithCardCount,
  getTeamsByIds,
  getTeamsByOwner,
  listTeamMembers,
  listTeamMembersByTeamIds,
} from "@/db/queries/teams";
import {
  listLiveClassroomSessionsForTeams,
  listLiveClassroomTeacherGrants,
  listLiveClassroomTeacherGrantsForUser,
} from "@/db/queries/live-classroom";
import { teamOwnsLiveClassroom } from "@/lib/live-classroom-access";
import { isLiveClassroomEligiblePlanSlug } from "@/lib/live-classroom-eligibility";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";
import type { LiveClassroomSessionStatus } from "@/lib/live-classroom-types";

export type LiveClassroomBridgeDeck = {
  id: number;
  name: string;
  cardCount: number;
};

export type LiveClassroomBridgeAdmin = {
  userId: string;
  displayName: string;
  hasHostToken: boolean;
};

export type LiveClassroomBridgeSession = {
  id: number;
  teamId: number;
  teamName: string;
  name: string;
  status: LiveClassroomSessionStatus;
  joinCode: string;
};

export type LiveClassroomBridgeWorkspace = {
  teamId: number;
  name: string;
  planSlug: string;
  licensedSeats: number;
  isOwner: boolean;
  decks: LiveClassroomBridgeDeck[];
  teamAdmins: LiveClassroomBridgeAdmin[];
  /** Unassigned host tokens available to drop onto team admins. */
  availableHostTokens: number;
  liveSessions: LiveClassroomBridgeSession[];
};

export type LiveClassroomBridgeData = {
  userId: string;
  isOwnerViewer: boolean;
  workspaces: LiveClassroomBridgeWorkspace[];
  /** Flat list of live battles across visible workspaces (owner sees all). */
  liveBattles: LiveClassroomBridgeSession[];
};

const LIVE_BATTLE_STATUSES: LiveClassroomSessionStatus[] = [
  "lobby",
  "scheduled",
  "active",
  "paused",
];

/**
 * Owner (add-on holder) or team admin with at least one host token can open
 * the Live Classroom bridge from the dashboard button.
 */
export async function userCanEnterLiveClassroomBridge(
  userId: string,
  access?: AccessContext | null,
): Promise<boolean> {
  const ctx = access ?? (await getAccessContext());
  if (accessHasAddon(ctx, LIVE_CLASSROOM_ADDON_KEY)) return true;

  const grants = await listLiveClassroomTeacherGrantsForUser(userId);
  if (grants.length === 0) return false;

  const teams = await getTeamsByIds(grants.map((g) => g.teamId));
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const members = await listTeamMembersByTeamIds(grants.map((g) => g.teamId));

  for (const grant of grants) {
    const team = teamById.get(grant.teamId);
    if (!team || !isLiveClassroomEligiblePlanSlug(team.planSlug)) continue;
    const membership = members.find(
      (m) => m.teamId === grant.teamId && m.userId === userId,
    );
    if (membership?.role !== "team_admin") continue;
    const ownership = await teamOwnsLiveClassroom(grant.teamId);
    if (ownership.owns) return true;
  }
  return false;
}

export async function loadLiveClassroomBridgeData(): Promise<LiveClassroomBridgeData | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const access = await getAccessContext();
  const ownedTeams = await getTeamsByOwner(userId);
  const ownerWorkspaces: { teamId: number; isOwner: true }[] = [];

  for (const team of ownedTeams) {
    if (!isLiveClassroomEligiblePlanSlug(team.planSlug)) continue;
    const ownership = await teamOwnsLiveClassroom(team.id);
    if (!ownership.owns) continue;
    ownerWorkspaces.push({ teamId: team.id, isOwner: true });
  }

  const hostGrants = await listLiveClassroomTeacherGrantsForUser(userId);
  const tokenTeamIds = [
    ...new Set(
      hostGrants
        .map((g) => g.teamId)
        .filter((id) => !ownerWorkspaces.some((w) => w.teamId === id)),
    ),
  ];

  const tokenTeams = await getTeamsByIds(tokenTeamIds);
  const tokenMembers =
    tokenTeamIds.length > 0
      ? await listTeamMembersByTeamIds(tokenTeamIds)
      : [];

  const tokenWorkspaces: { teamId: number; isOwner: false }[] = [];
  for (const team of tokenTeams) {
    if (!isLiveClassroomEligiblePlanSlug(team.planSlug)) continue;
    const membership = tokenMembers.find(
      (m) => m.teamId === team.id && m.userId === userId,
    );
    if (membership?.role !== "team_admin") continue;
    const ownership = await teamOwnsLiveClassroom(team.id);
    if (!ownership.owns) continue;
    tokenWorkspaces.push({ teamId: team.id, isOwner: false });
  }

  // Owners with the add-on see every owned LC workspace.
  // Token team admins see assigned workspaces (and owners can also hold tokens
  // on other orgs — merge both lists).
  const isOwnerViewer =
    ownerWorkspaces.length > 0 ||
    accessHasAddon(access, LIVE_CLASSROOM_ADDON_KEY);

  const ownedIds = new Set(ownerWorkspaces.map((w) => w.teamId));
  const workspaceRefs = [
    ...ownerWorkspaces,
    ...tokenWorkspaces.filter((w) => !ownedIds.has(w.teamId)),
  ];

  if (workspaceRefs.length === 0) {
    return {
      userId,
      isOwnerViewer,
      workspaces: [],
      liveBattles: [],
    };
  }

  const teamIds = workspaceRefs.map((w) => w.teamId);
  const teams = await getTeamsByIds(teamIds);
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const allMembers = await listTeamMembersByTeamIds(teamIds);
  const adminUserIds = [
    ...new Set(
      allMembers
        .filter((m) => m.role === "team_admin")
        .map((m) => m.userId),
    ),
  ];
  const displays = await getClerkUserFieldDisplaysByIds(adminUserIds);

  const liveSessions = await listLiveClassroomSessionsForTeams(teamIds, {
    status: LIVE_BATTLE_STATUSES,
    limit: 40,
  });

  const workspaces: LiveClassroomBridgeWorkspace[] = [];

  for (const ref of workspaceRefs) {
    const team = teamById.get(ref.teamId);
    if (!team) continue;
    const ownership = await teamOwnsLiveClassroom(team.id);
    const grants = await listLiveClassroomTeacherGrants(team.id);
    const grantUserIds = new Set(grants.map((g) => g.userId));

    const teamAdmins: LiveClassroomBridgeAdmin[] = allMembers
      .filter((m) => m.teamId === team.id && m.role === "team_admin")
      .map((m) => ({
        userId: m.userId,
        displayName: displays[m.userId]?.primaryLine ?? m.userId,
        hasHostToken: grantUserIds.has(m.userId),
      }));

    const availableHostTokens = Math.max(
      0,
      teamAdmins.length - teamAdmins.filter((a) => a.hasHostToken).length,
    );

    let decks: LiveClassroomBridgeDeck[] = [];
    if (ref.isOwner) {
      const rows = await getDecksForTeamWithCardCount(team.id, team.ownerUserId);
      decks = rows.map((d) => ({
        id: d.id,
        name: d.name,
        cardCount: Number(d.cardCount) || 0,
      }));
    } else {
      const rows = await getAssignedDecksForMemberWithCardCount(
        team.id,
        userId,
      );
      decks = rows.map((d) => ({
        id: d.id,
        name: d.name,
        cardCount: Number(d.cardCount) || 0,
      }));
    }

    const workspaceSessions = liveSessions
      .filter((s) => s.teamId === team.id)
      .map((s) => ({
        id: s.id,
        teamId: s.teamId,
        teamName: team.name,
        name: s.name,
        status: s.status,
        joinCode: s.joinCode,
      }));

    workspaces.push({
      teamId: team.id,
      name: team.name,
      planSlug: team.planSlug,
      licensedSeats: ownership.licensedSeats,
      isOwner: ref.isOwner,
      decks,
      teamAdmins: ref.isOwner ? teamAdmins : [],
      availableHostTokens: ref.isOwner ? availableHostTokens : 0,
      liveSessions: workspaceSessions,
    });
  }

  const liveBattles = workspaces.flatMap((w) => w.liveSessions);

  return {
    userId,
    isOwnerViewer,
    workspaces,
    liveBattles,
  };
}
