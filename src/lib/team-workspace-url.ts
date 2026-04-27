/** Query string keys for team-tier workspace URLs on `/dashboard` and `/decks/.../study`. */

export const TEAM_WORKSPACE_QUERY = {
  team: "team",
  userid: "userid",
  plan: "plan",
  teamMemberId: "teamMemberId",
} as const;

export type TeamWorkspaceNavTeam = {
  id: number;
  name: string;
  ownerUserId: string;
  /** `0` in the URL means the subscriber (owner); invited users use their `team_members.id`. */
  teamMemberUrlParam: number;
  /** Team subscription label (e.g. Team Basic) from `teams.planSlug`. */
  planLabel: string;
  /** Value for the `plan` query on team workspace links (Clerk team plan id or `pro`). */
  planUrlValue: string;
  /** Resolved owner display name for the workspace switcher. */
  ownerDisplayName: string;
  /** Subscriber owner or `team_admin` — may open `/dashboard/team-admin` for this workspace. */
  canAccessTeamAdmin: boolean;
  /**
   * True when the signed-in user is the subscriber/owner of this team workspace.
   * Computed server-side to avoid relying on client-side auth during SSR hydration.
   */
  isSubscriberOwned: boolean;
};

export function buildTeamWorkspaceQueryString(input: {
  teamId: number;
  ownerUserId: string;
  teamMemberUrlParam: number;
  /** Personal Pro uses `pro`; team workspaces should pass the team’s Clerk plan id when known. */
  plan?: string;
}): string {
  const p = new URLSearchParams();
  p.set(TEAM_WORKSPACE_QUERY.team, String(input.teamId));
  p.set(TEAM_WORKSPACE_QUERY.userid, input.ownerUserId);
  p.set(TEAM_WORKSPACE_QUERY.plan, input.plan ?? "pro");
  p.set(TEAM_WORKSPACE_QUERY.teamMemberId, String(input.teamMemberUrlParam));
  return p.toString();
}

export function buildTeamWorkspaceDashboardPath(input: {
  teamId: number;
  ownerUserId: string;
  teamMemberUrlParam: number;
  plan?: string;
}): string {
  return `/dashboard?${buildTeamWorkspaceQueryString(input)}`;
}

/** Append `?` or `&` and workspace query to a path that may already have a query. */
export function withTeamWorkspaceQuery(
  pathname: string,
  workspaceQueryString: string,
): string {
  if (!workspaceQueryString) return pathname;
  const joiner = pathname.includes("?") ? "&" : "?";
  return `${pathname}${joiner}${workspaceQueryString}`;
}
