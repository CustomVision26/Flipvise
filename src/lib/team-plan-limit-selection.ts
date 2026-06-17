import { limitsForPlan } from "@/lib/team-plans";

type WithCreatedAt = { createdAt: Date };

/** Newest-first (most recently added last in time = kept on downgrade). */
export function sortByNewestFirst<T extends WithCreatedAt>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const at = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
    const bt = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
    return bt - at;
  });
}

export function selectNewestWithinLimit<T extends WithCreatedAt>(
  rows: readonly T[],
  limit: number,
): T[] {
  if (limit <= 0) return [];
  return sortByNewestFirst(rows).slice(0, limit);
}

export function selectNewestTeamsWithinWorkspaceLimit<
  T extends WithCreatedAt & { id: number },
>(teams: readonly T[], planSlug: string): T[] {
  const { maxTeams } = limitsForPlan(planSlug);
  return selectNewestWithinLimit(teams, maxTeams);
}

export function selectNewestMembersWithinMemberLimit<
  T extends WithCreatedAt & { userId: string },
>(members: readonly T[], planSlug: string): T[] {
  const { maxMembersPerTeam } = limitsForPlan(planSlug);
  return selectNewestWithinLimit(members, maxMembersPerTeam);
}

export function teamIdsWithinWorkspaceLimit<
  T extends WithCreatedAt & { id: number },
>(teams: readonly T[], planSlug: string): Set<number> {
  return new Set(
    selectNewestTeamsWithinWorkspaceLimit(teams, planSlug).map((t) => t.id),
  );
}

export function memberUserIdsWithinMemberLimit<
  T extends WithCreatedAt & { userId: string },
>(members: readonly T[], planSlug: string): Set<string> {
  return new Set(
    selectNewestMembersWithinMemberLimit(members, planSlug).map((m) => m.userId),
  );
}

export function isTeamWithinWorkspaceLimit<
  T extends WithCreatedAt & { id: number },
>(teamId: number, ownedTeams: readonly T[], planSlug: string): boolean {
  return teamIdsWithinWorkspaceLimit(ownedTeams, planSlug).has(teamId);
}

export function isMemberWithinMemberLimit<
  T extends WithCreatedAt & { userId: string },
>(memberUserId: string, members: readonly T[], planSlug: string): boolean {
  return memberUserIdsWithinMemberLimit(members, planSlug).has(memberUserId);
}
