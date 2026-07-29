import type { RootLayoutTeamAdminHeaderTeam } from "@/db/queries/teams";
import type { AccessContext } from "@/lib/access";
import { hasEducationPlan } from "@/lib/education-plans";

/** True when the viewer has a personal education plan or manages an education workspace. */
export function showTeacherDashboardFromShell(input: {
  access: Pick<AccessContext, "canAccessTeacherTools">;
  teamAdminHeaderTeams: RootLayoutTeamAdminHeaderTeam[];
}): boolean {
  if (input.access.canAccessTeacherTools) return true;
  return input.teamAdminHeaderTeams.some(
    (t) =>
      t.workspacePlanQuery != null && hasEducationPlan(t.workspacePlanQuery),
  );
}

/**
 * Teacher Dash under Personal in the workspace switcher — education plan owners only
 * (Education Plus personal, or owner of an Education Gold/Enterprise workspace).
 * Invited co-admins use the invited-workspace expand actions instead.
 */
export function showPersonalTeacherDashFromShell(input: {
  userId: string;
  access: Pick<AccessContext, "canAccessTeacherTools">;
  teamAdminHeaderTeams: RootLayoutTeamAdminHeaderTeam[];
}): boolean {
  if (input.access.canAccessTeacherTools) return true;
  return input.teamAdminHeaderTeams.some(
    (t) =>
      t.ownerUserId === input.userId &&
      t.workspacePlanQuery != null &&
      hasEducationPlan(t.workspacePlanQuery),
  );
}
