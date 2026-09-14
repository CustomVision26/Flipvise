/**
 * Team workspace dashboard links use `team` (workspace id). Owner identity and
 * member row ids are resolved from the signed-in session — not from the URL.
 */
export const TEAM_WORKSPACE_QUERY = {
  team: "team",
  userid: "userid",
  plan: "plan",
  teamMemberId: "teamMemberId",
} as const;

/** Subscriber-owned workspace create / rename / delete. */
export const MANAGE_WORKSPACES_HREF = "/dashboard/workspaces";

export type TeamWorkspaceNavTeam = {
  id: number;
  name: string;
  ownerUserId: string;
  /** `0` for the subscriber owner; else the viewer’s `team_members.id` (not sent in URLs). */
  teamMemberUrlParam: number;
  /** Team subscription label (e.g. Team Basic) from `teams.planSlug`. */
  planLabel: string;
  /** Clerk team plan id or `pro` — used in workspace dashboard query strings. */
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

export function buildTeamWorkspaceQueryString(input: { teamId: number }): string {
  const p = new URLSearchParams();
  p.set(TEAM_WORKSPACE_QUERY.team, String(input.teamId));
  return p.toString();
}

export function buildTeamWorkspaceDashboardPath(input: {
  teamId: number;
  ownerUserId?: string;
  planSlug?: string;
  teamMemberUrlParam?: number;
}): string {
  return `/dashboard?${buildTeamWorkspaceQueryString({ teamId: input.teamId })}`;
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
