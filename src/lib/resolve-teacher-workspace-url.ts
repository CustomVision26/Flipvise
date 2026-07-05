import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/clerk-auth";
import { getTeamsForTeamDashboard } from "@/db/queries/teams";
import { isEducationTeamPlanId } from "@/lib/education-plans";
import { TEAM_CONTEXT_COOKIE } from "@/lib/team-context-cookie";
import { resolveTeamAdminDashboardSelection } from "@/lib/resolve-team-admin-dashboard-selection";
import { buildTeamAdminQueryString } from "@/lib/team-admin-url";
import {
  buildTeacherPageCanonicalPath,
  buildTeacherPath,
  type TeacherWorkspaceContext,
} from "@/lib/teacher-url";

export type { TeacherWorkspaceContext } from "@/lib/teacher-url";

function firstParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = searchParams[key];
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null || String(raw).trim() === "") return undefined;
  return String(raw).trim();
}

function preservedExtraParams(
  pathname: string,
  searchParams: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const extra = new URLSearchParams();
  if (
    pathname === "/teacher/quizzes" ||
    pathname.startsWith("/teacher/quizzes/") ||
    pathname === "/teacher/study-guides" ||
    pathname.startsWith("/teacher/study-guides/")
  ) {
    const lessonPlanId = firstParam(searchParams, "lessonPlanId");
    if (lessonPlanId) {
      extra.set("lessonPlanId", lessonPlanId);
    }
  }
  return extra;
}

export async function resolveTeacherWorkspaceContext(
  userId: string,
  pathname: string,
  searchParams: Record<string, string | string[] | undefined>,
): Promise<TeacherWorkspaceContext> {
  const extra = preservedExtraParams(pathname, searchParams);
  const manageTeams = (await getTeamsForTeamDashboard(userId)).filter((team) =>
    isEducationTeamPlanId(team.planSlug),
  );

  if (manageTeams.length > 0) {
    const cookieStore = await cookies();
    const cookieRaw = cookieStore.get(TEAM_CONTEXT_COOKIE)?.value;
    const result = await resolveTeamAdminDashboardSelection(manageTeams, {
      viewerUserId: userId,
      teamParam: firstParam(searchParams, "team"),
      teamMemberIdParam: firstParam(searchParams, "teamMemberId"),
      cookieTeamRaw: cookieRaw,
      buildCanonicalPath: (teamId, teamMemberUrlParam) =>
        buildTeacherPageCanonicalPath(pathname, teamId, teamMemberUrlParam, extra),
    });

    if (result.outcome === "redirect") {
      redirect(result.to);
    }

    const queryString = buildTeamAdminQueryString(
      result.selected.id,
      result.viewerTeamMemberUrlParam,
    );
    return {
      teamId: result.selected.id,
      teamMemberId: result.viewerTeamMemberUrlParam,
      queryString,
    };
  }

  const teamMemberParam = firstParam(searchParams, "teamMemberId");
  const parsedTeamMember =
    teamMemberParam != null ? Number(teamMemberParam) : Number.NaN;
  const expectedTeamMemberId = 0;
  const missingTeamMember =
    !Number.isFinite(parsedTeamMember) ||
    parsedTeamMember !== expectedTeamMemberId;
  const hasTeamParam = firstParam(searchParams, "team") != null;

  if (missingTeamMember || hasTeamParam) {
    redirect(
      buildTeacherPageCanonicalPath(pathname, null, expectedTeamMemberId, extra),
    );
  }

  const queryString = buildTeamAdminQueryString(null, expectedTeamMemberId);
  return {
    teamId: null,
    teamMemberId: expectedTeamMemberId,
    queryString,
  };
}

export type TeacherPageContext = {
  userId: string;
  workspace: TeacherWorkspaceContext;
  backHref: string;
};

export async function loadTeacherPageContext(
  pathname: string,
  searchParams: Record<string, string | string[] | undefined>,
): Promise<TeacherPageContext> {
  const { userId } = await auth();
  if (!userId) {
    redirect("/");
  }

  const workspace = await resolveTeacherWorkspaceContext(
    userId,
    pathname,
    searchParams,
  );

  return {
    userId,
    workspace,
    backHref: buildTeacherPath(workspace.teamId, workspace.teamMemberId),
  };
}
