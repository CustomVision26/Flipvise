import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/clerk-auth";
import { getTeamsForTeamDashboard } from "@/db/queries/teams";
import { isEducationTeamPlanId } from "@/lib/education-plans";
import { TEAM_CONTEXT_COOKIE } from "@/lib/team-context-cookie";
import { resolveTeamAdminDashboardSelection } from "@/lib/resolve-team-admin-dashboard-selection";
import {
  buildTeacherPageCanonicalPath,
  buildTeacherPath,
  buildTeacherQueryString,
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
    pathname.startsWith("/teacher/study-guides/") ||
    pathname === "/teacher/homework" ||
    pathname.startsWith("/teacher/homework/") ||
    pathname === "/teacher/worksheets" ||
    pathname.startsWith("/teacher/worksheets/") ||
    pathname === "/teacher/lesson-builder" ||
    pathname.startsWith("/teacher/lesson-builder/")
  ) {
    const lessonPlanId = firstParam(searchParams, "lessonPlanId");
    if (lessonPlanId) {
      extra.set("lessonPlanId", lessonPlanId);
    }
    const homeworkId = firstParam(searchParams, "homeworkId");
    if (homeworkId) {
      extra.set("homeworkId", homeworkId);
    }
    const worksheetId = firstParam(searchParams, "worksheetId");
    if (worksheetId) {
      extra.set("worksheetId", worksheetId);
    }
    const studyGuideId = firstParam(searchParams, "studyGuideId");
    if (studyGuideId) {
      extra.set("studyGuideId", studyGuideId);
    }
    const deckId = firstParam(searchParams, "deckId");
    if (deckId) {
      extra.set("deckId", deckId);
    }
    const sourceType = firstParam(searchParams, "sourceType");
    if (sourceType) {
      extra.set("sourceType", sourceType);
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

    const queryString = buildTeacherQueryString(
      result.selected.id,
      result.viewerTeamMemberUrlParam,
    );
    return {
      teamId: result.selected.id,
      teamMemberId: result.viewerTeamMemberUrlParam,
      queryString,
    };
  }

  const hasTeamQuery =
    firstParam(searchParams, "team") != null ||
    firstParam(searchParams, "teamMemberId") != null;

  if (hasTeamQuery) {
    redirect(buildTeacherPageCanonicalPath(pathname, null, null, extra));
  }

  return {
    teamId: null,
    teamMemberId: 0,
    queryString: "",
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
