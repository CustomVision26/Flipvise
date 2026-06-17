import {
  countPendingInvitationsForTeam,
  getTeamById,
  getTeamsByOwner,
  listPendingInvitations,
  listTeamMembers,
  revokePendingTeamInvitation,
} from "@/db/queries/teams";
import {
  isMemberWithinMemberLimit,
  isTeamWithinWorkspaceLimit,
  selectNewestMembersWithinMemberLimit,
  selectNewestTeamsWithinWorkspaceLimit,
  sortByNewestFirst,
} from "@/lib/team-plan-limit-selection";
import { isTeamPlanId, limitsForPlan } from "@/lib/team-plans";

export async function getOwnedTeamsWithinSubscriptionLimit(ownerUserId: string) {
  const owned = await getTeamsByOwner(ownerUserId);
  const planTeam = owned.find((t) => isTeamPlanId(t.planSlug));
  if (!planTeam) return owned;
  return selectNewestTeamsWithinWorkspaceLimit(owned, planTeam.planSlug);
}

export async function isTeamAccessibleUnderSubscriptionPlan(
  teamId: number,
): Promise<boolean> {
  const team = await getTeamById(teamId);
  if (!team || !isTeamPlanId(team.planSlug)) return false;
  const owned = await getTeamsByOwner(team.ownerUserId);
  return isTeamWithinWorkspaceLimit(teamId, owned, team.planSlug);
}

export async function isTeamMemberAccessibleUnderSubscriptionPlan(
  teamId: number,
  memberUserId: string,
): Promise<boolean> {
  const team = await getTeamById(teamId);
  if (!team || !isTeamPlanId(team.planSlug)) return false;
  const members = await listTeamMembers(teamId);
  return isMemberWithinMemberLimit(memberUserId, members, team.planSlug);
}

export async function countMembersWithinSubscriptionLimit(
  teamId: number,
  planSlug: string,
): Promise<number> {
  const members = await listTeamMembers(teamId);
  return selectNewestMembersWithinMemberLimit(members, planSlug).length;
}

export async function teamMemberInviteCapacity(planId: string, teamId: number) {
  const limits = limitsForPlan(planId);
  const [members, pending] = await Promise.all([
    listTeamMembers(teamId),
    countPendingInvitationsForTeam(teamId),
  ]);
  const activeMembers = selectNewestMembersWithinMemberLimit(
    members,
    planId,
  ).length;
  return {
    activeMembers,
    pending,
    maxMembersPerTeam: limits.maxMembersPerTeam,
    atCapacity: activeMembers + pending >= limits.maxMembersPerTeam,
  };
}

async function revokePendingInvitations(invitationIds: number[], teamId: number) {
  for (const invitationId of invitationIds) {
    await revokePendingTeamInvitation(invitationId, teamId);
  }
}

/**
 * After a downgrade (or any plan sync), trim pending invites so active members + pending
 * never exceeds the plan member cap. Oldest pending invites are revoked first.
 */
export async function trimPendingInvitationsToPlanLimit(
  teamId: number,
  planSlug: string,
): Promise<void> {
  if (!isTeamPlanId(planSlug)) return;

  const limits = limitsForPlan(planSlug);
  const [members, pendingInvites] = await Promise.all([
    listTeamMembers(teamId),
    listPendingInvitations(teamId),
  ]);
  const activeMembers = selectNewestMembersWithinMemberLimit(members, planSlug).length;
  const slotsForPending = Math.max(0, limits.maxMembersPerTeam - activeMembers);
  if (pendingInvites.length <= slotsForPending) return;

  const toRevoke = sortByNewestFirst(pendingInvites)
    .slice(slotsForPending)
    .map((inv) => inv.id);
  await revokePendingInvitations(toRevoke, teamId);
}

/**
 * Applies workspace + member policy after a subscriber's team-tier plan changes.
 * Data is retained so upgrades restore access; downgrade trims pending invites only.
 */
export async function enforceSubscriptionPlanLimitsForOwner(
  ownerUserId: string,
  planSlug: string,
): Promise<void> {
  if (!isTeamPlanId(planSlug)) return;

  const owned = await getTeamsByOwner(ownerUserId);
  const withinLimit = selectNewestTeamsWithinWorkspaceLimit(owned, planSlug);
  const withinIds = new Set(withinLimit.map((t) => t.id));

  await Promise.all(
    owned.map(async (team) => {
      if (!withinIds.has(team.id)) {
        const pending = await listPendingInvitations(team.id);
        await revokePendingInvitations(
          pending.map((p) => p.id),
          team.id,
        );
        return;
      }
      await trimPendingInvitationsToPlanLimit(team.id, planSlug);
    }),
  );
}
