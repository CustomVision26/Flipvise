import "server-only";

import { cookies } from "next/headers";
import { getAccessContext } from "@/lib/access";
import { getMemberRecord, getTeamsForTeamDashboard } from "@/db/queries/teams";
import { personalDashboardHrefWithUserPlanQuery } from "@/lib/personal-dashboard-url";
import { TEAM_CONTEXT_COOKIE } from "@/lib/team-context-cookie";
import { buildTeamAdminPath } from "@/lib/team-admin-url";
import { buildTeamWorkspaceDashboardPath } from "@/lib/team-workspace-url";
import type { TeacherTopDashboardLinks } from "@/lib/resolve-teacher-top-dashboard-links";

/**
 * Personal / Team / Team Admin shortcuts for Team Admin pages.
 * Uses any manage-capable workspace (not education-only), matching the
 * Teacher top bar layout.
 */
export async function resolveTeamAdminTopDashboardLinks(
  userId: string,
): Promise<TeacherTopDashboardLinks> {
  const ctx = await getAccessContext();
  const personalDashboardHref = personalDashboardHrefWithUserPlanQuery({
    userId,
    activeTeamPlan: ctx.activeTeamPlan,
    activeEducationTeamPlan: ctx.activeEducationTeamPlan,
    isPro: ctx.isPro,
    hasClerkPersonalPro: ctx.hasClerkPersonalPro,
    hasClerkPersonalProPlus: ctx.hasClerkPersonalProPlus,
  });

  const manageTeams = await getTeamsForTeamDashboard(userId);

  if (manageTeams.length === 0) {
    return {
      personalDashboardHref,
      teamDashboardHref: null,
      teamDashboardTeamId: null,
      teamAdminHref: null,
      teamAdminTeamId: null,
    };
  }

  const cookieStore = await cookies();
  const cookieTeamId = Number(cookieStore.get(TEAM_CONTEXT_COOKIE)?.value);
  const selected =
    (Number.isFinite(cookieTeamId) && cookieTeamId > 0
      ? manageTeams.find((team) => team.id === cookieTeamId)
      : null) ??
    manageTeams.find((team) => team.ownerUserId === userId) ??
    manageTeams[0]!;

  const isOwner = selected.ownerUserId === userId;
  let teamMemberUrlParam = 0;
  if (!isOwner) {
    const member = await getMemberRecord(selected.id, userId);
    teamMemberUrlParam = member?.id ?? 0;
  }

  const teamDashboardHref = buildTeamWorkspaceDashboardPath({
    teamId: selected.id,
    ownerUserId: selected.ownerUserId,
    planSlug: selected.planSlug,
    teamMemberUrlParam,
  });

  const teamAdminHref = buildTeamAdminPath(selected.id, teamMemberUrlParam);

  return {
    personalDashboardHref,
    teamDashboardHref,
    teamDashboardTeamId: selected.id,
    teamAdminHref,
    teamAdminTeamId: selected.id,
  };
}
