/** Serializable membership history row passed from Server Components to client UI. */
export type TeamMemberHistoryRow = {
  id: number;
  teamId: number;
  ownerUserId: string;
  action: "added" | "removed";
  memberUserId: string;
  memberRole: "team_admin" | "team_member";
  actorUserId: string | null;
  createdAt: Date | string;
};
