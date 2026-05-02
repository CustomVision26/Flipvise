/**
 * Subscriber team admin (`/dashboard/team-admin`).
 * URLs use only `team=<workspace id>`; the signed-in user must own or co-admin the team.
 */

const TEAM_ADMIN_TEAM_PARAM = "team";

export function buildTeamAdminSearchParams(teamId?: number | null): string {
  if (teamId == null || !Number.isFinite(teamId) || teamId <= 0) return "";
  const p = new URLSearchParams();
  p.set(TEAM_ADMIN_TEAM_PARAM, String(teamId));
  return p.toString();
}

export function buildTeamAdminPath(teamId?: number | null): string {
  const qs = buildTeamAdminSearchParams(teamId);
  return qs ? `/dashboard/team-admin?${qs}` : "/dashboard/team-admin";
}
