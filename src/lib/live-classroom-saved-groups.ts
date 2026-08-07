/** Shared helpers for Live Classroom™ saved team groups. */

export const LIVE_CLASSROOM_MIN_MEMBERS_PER_TEAM = 2;

export type LiveClassroomSavedGroupTeam = {
  teamName: string;
  userIds: string[];
};

export type LiveClassroomSavedGroupIntegrity = {
  teams: Array<{
    teamName: string;
    presentUserIds: string[];
    missingUserIds: string[];
  }>;
  missingUserIds: string[];
  undersizedTeamNames: string[];
  /** True when every saved team still has ≥2 workspace members. */
  isValid: boolean;
  hasMissingMembers: boolean;
};

export function analyzeLiveClassroomSavedGroup(
  groups: LiveClassroomSavedGroupTeam[],
  workspaceUserIds: ReadonlySet<string>,
): LiveClassroomSavedGroupIntegrity {
  const teams = groups.map((g) => {
    const presentUserIds = g.userIds.filter((id) => workspaceUserIds.has(id));
    const missingUserIds = g.userIds.filter((id) => !workspaceUserIds.has(id));
    return {
      teamName: g.teamName,
      presentUserIds,
      missingUserIds,
    };
  });
  const missingUserIds = [
    ...new Set(teams.flatMap((t) => t.missingUserIds)),
  ];
  const undersizedTeamNames = teams
    .filter(
      (t) => t.presentUserIds.length < LIVE_CLASSROOM_MIN_MEMBERS_PER_TEAM,
    )
    .map((t) => t.teamName);
  const hasMissingMembers = missingUserIds.length > 0;
  return {
    teams,
    missingUserIds,
    undersizedTeamNames,
    hasMissingMembers,
    isValid: !hasMissingMembers && undersizedTeamNames.length === 0,
  };
}

export function assertSavedGroupTeamsValid(
  groups: LiveClassroomSavedGroupTeam[],
): void {
  if (groups.length === 0) {
    throw new Error("Add members to at least one team before saving.");
  }
  for (const g of groups) {
    if (g.userIds.length < LIVE_CLASSROOM_MIN_MEMBERS_PER_TEAM) {
      throw new Error(
        `${g.teamName} needs at least ${LIVE_CLASSROOM_MIN_MEMBERS_PER_TEAM} members.`,
      );
    }
  }
  const seen = new Set<string>();
  for (const g of groups) {
    for (const userId of g.userIds) {
      if (seen.has(userId)) {
        throw new Error("A member cannot be on more than one team.");
      }
      seen.add(userId);
    }
  }
}
