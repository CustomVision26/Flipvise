import "server-only";

import { getTeamById, listTeamMembers } from "@/db/queries/teams";
import { isEducationTeamPlanId } from "@/lib/education-plans";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";

export type WorkspaceStudentInvitee = {
  key: string;
  label: string;
  email: string;
  memberUserId: string;
  invitedByUserId: string | null;
  invitedByLabel: string | null;
};

function memberInviteeKey(userId: string) {
  return `member:${userId}`;
}

function wasInvitedByOwnerOrTeamAdmin(
  invitedByUserId: string | null,
  addedByAsOwner: boolean | null,
  ownerUserId: string,
  adminUserIds: Set<string>,
): boolean {
  if (!invitedByUserId) return true;
  if (invitedByUserId === ownerUserId) return true;
  if (addedByAsOwner) return true;
  return adminUserIds.has(invitedByUserId);
}

export async function listWorkspaceStudentInviteesForTeam(
  teamId: number,
): Promise<WorkspaceStudentInvitee[]> {
  const team = await getTeamById(teamId);
  if (!team || !isEducationTeamPlanId(team.planSlug)) {
    return [];
  }

  const members = await listTeamMembers(teamId);

  const adminUserIds = new Set(
    members
      .filter((member) => member.role === "team_admin")
      .map((member) => member.userId),
  );

  const eligibleMembers = members.filter(
    (member) =>
      member.role === "team_member" &&
      wasInvitedByOwnerOrTeamAdmin(
        member.addedByUserId ?? null,
        member.addedByAsOwner ?? null,
        team.ownerUserId,
        adminUserIds,
      ),
  );

  const inviterIds = [
    ...new Set([
      ...eligibleMembers
        .map((member) => member.addedByUserId)
        .filter((id): id is string => Boolean(id)),
      team.ownerUserId,
    ]),
  ];

  const displayById = await getClerkUserFieldDisplaysByIds([
    ...eligibleMembers.map((member) => member.userId),
    ...inviterIds,
  ]);

  const invitees: WorkspaceStudentInvitee[] = [];

  for (const member of eligibleMembers) {
    const display = displayById[member.userId];
    const inviterDisplay = member.addedByUserId
      ? displayById[member.addedByUserId]
      : displayById[team.ownerUserId];

    invitees.push({
      key: memberInviteeKey(member.userId),
      label: display?.primaryLine ?? member.userId,
      email: display?.primaryEmail ?? "",
      memberUserId: member.userId,
      invitedByUserId: member.addedByUserId ?? team.ownerUserId,
      invitedByLabel:
        inviterDisplay?.primaryLine ??
        inviterDisplay?.primaryEmail ??
        "Workspace owner",
    });
  }

  return invitees.sort((a, b) => a.label.localeCompare(b.label));
}

export async function resolveWorkspaceStudentInviteeForTeam(
  teamId: number,
  inviteeKey: string,
): Promise<WorkspaceStudentInvitee | null> {
  const invitees = await listWorkspaceStudentInviteesForTeam(teamId);
  return invitees.find((invitee) => invitee.key === inviteeKey) ?? null;
}
