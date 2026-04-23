/**
 * Subscriber team admin (`/dashboard/team-admin`).
 * `userid` is the Clerk id of the team-tier subscriber (the team row's `ownerUserId`).
 * `team` is the workspace id when a specific team is selected.
 * `plan` is that workspace’s Clerk team plan id when the row is team-tier (e.g. `pro_team_gold`).
 */
export function buildTeamAdminSearchParams(
  subscriberUserId: string,
  teamId?: number | null,
  workspacePlanQuery?: string | null,
): string {
  const p = new URLSearchParams();
  p.set("userid", subscriberUserId);
  if (teamId != null && Number.isFinite(teamId)) {
    p.set("team", String(teamId));
  }
  if (workspacePlanQuery != null && workspacePlanQuery.trim() !== "") {
    p.set("plan", workspacePlanQuery.trim());
  }
  return p.toString();
}

export function buildTeamAdminPath(
  subscriberUserId: string,
  teamId?: number | null,
  workspacePlanQuery?: string | null,
) {
  return `/dashboard/team-admin?${buildTeamAdminSearchParams(
    subscriberUserId,
    teamId,
    workspacePlanQuery,
  )}`;
}
