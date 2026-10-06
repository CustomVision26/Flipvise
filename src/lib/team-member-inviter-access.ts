/**
 * Team-admin roster / assignment rights keyed off Added by (inviter).
 * Workspace owners manage every member. Invited team admins may update or
 * remove only members they invited (`team_members.addedByUserId`).
 */

export const TEAM_ADMIN_INVITER_ONLY_MESSAGE =
  "Team admins can only update or remove members they invited. The workspace owner can manage every member.";

export function canManageMemberAsOwnerOrInviter(input: {
  viewerUserId: string;
  ownerUserId: string;
  memberUserId: string;
  addedByUserId: string | null | undefined;
}): boolean {
  if (input.memberUserId === input.viewerUserId) return false;
  if (input.memberUserId === input.ownerUserId) return false;
  if (input.viewerUserId === input.ownerUserId) return true;
  return Boolean(
    input.addedByUserId && input.addedByUserId === input.viewerUserId,
  );
}
