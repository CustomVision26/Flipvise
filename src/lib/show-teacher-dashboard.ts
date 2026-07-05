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
