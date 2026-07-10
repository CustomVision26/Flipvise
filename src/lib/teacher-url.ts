import { buildTeamAdminQueryString } from "@/lib/team-admin-url";

export const TEACHER_PATH = "/teacher";
export const TEACHER_QUIZZES_PATH = "/teacher/quizzes";

export type TeacherWorkspaceContext = {
  teamId: number | null;
  teamMemberId: number;
  queryString: string;
};

/** Personal education plans (e.g. Education Plus) use bare `/teacher` — no team query params. */
export function buildTeacherQueryString(
  teamId?: number | null,
  teamMemberId?: number | null,
): string {
  if (teamId == null || !Number.isFinite(teamId) || teamId <= 0) {
    return "";
  }
  return buildTeamAdminQueryString(teamId, teamMemberId);
}

export function buildTeacherPath(
  teamId?: number | null,
  teamMemberId?: number | null,
): string {
  const qs = buildTeacherQueryString(teamId, teamMemberId);
  return qs ? `${TEACHER_PATH}?${qs}` : TEACHER_PATH;
}

export function buildTeacherQuizzesPath(
  teamId?: number | null,
  teamMemberId?: number | null,
  extra?: URLSearchParams,
): string {
  const p = new URLSearchParams(buildTeacherQueryString(teamId, teamMemberId));
  if (extra) {
    extra.forEach((value, key) => {
      if (!p.has(key)) {
        p.set(key, value);
      }
    });
  }
  const qs = p.toString();
  return qs ? `${TEACHER_QUIZZES_PATH}?${qs}` : TEACHER_QUIZZES_PATH;
}

export function buildTeacherLessonBuilderPath(
  teamId?: number | null,
  teamMemberId?: number | null,
  extra?: URLSearchParams,
): string {
  const p = new URLSearchParams(buildTeacherQueryString(teamId, teamMemberId));
  if (extra) {
    extra.forEach((value, key) => {
      if (!p.has(key)) {
        p.set(key, value);
      }
    });
  }
  const qs = p.toString();
  return qs ? `${TEACHER_PATH}/lesson-builder?${qs}` : `${TEACHER_PATH}/lesson-builder`;
}

function buildTeacherToolPath(
  suffix: string,
  teamId?: number | null,
  teamMemberId?: number | null,
  extra?: URLSearchParams,
): string {
  const normalized = suffix.startsWith("/") ? suffix : `/${suffix}`;
  const path = `${TEACHER_PATH}${normalized}`;
  const p = new URLSearchParams(buildTeacherQueryString(teamId, teamMemberId));
  if (extra) {
    extra.forEach((value, key) => {
      if (!p.has(key)) {
        p.set(key, value);
      }
    });
  }
  const qs = p.toString();
  return qs ? `${path}?${qs}` : path;
}

export function buildTeacherHomeworkPath(
  teamId?: number | null,
  teamMemberId?: number | null,
  extra?: URLSearchParams,
): string {
  return buildTeacherToolPath("/homework", teamId, teamMemberId, extra);
}

export function buildTeacherWorksheetsPath(
  teamId?: number | null,
  teamMemberId?: number | null,
  extra?: URLSearchParams,
): string {
  return buildTeacherToolPath("/worksheets", teamId, teamMemberId, extra);
}

export function buildTeacherStudyGuidesPath(
  teamId?: number | null,
  teamMemberId?: number | null,
  extra?: URLSearchParams,
): string {
  return buildTeacherToolPath("/study-guides", teamId, teamMemberId, extra);
}

export function buildTeacherSubPath(
  suffix: string,
  teamId?: number | null,
  teamMemberId?: number | null,
): string {
  const normalized = suffix.startsWith("/") ? suffix : `/${suffix}`;
  const path = `${TEACHER_PATH}${normalized}`;
  const qs = buildTeacherQueryString(teamId, teamMemberId);
  return qs ? `${path}?${qs}` : path;
}

/** Prefer this in server-rendered teacher nav so workspace query params stay canonical. */
export function buildTeacherToolHref(
  suffix: string,
  workspace: TeacherWorkspaceContext,
): string {
  const normalized = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return withTeacherQuery(`${TEACHER_PATH}${normalized}`, workspace.queryString);
}

export function withTeacherQuery(pathname: string, queryString: string): string {
  if (!queryString) return pathname;
  const joiner = pathname.includes("?") ? "&" : "?";
  return `${pathname}${joiner}${queryString}`;
}

export function isTeacherDashboardPath(pathname: string): boolean {
  return pathname === TEACHER_PATH || pathname.startsWith(`${TEACHER_PATH}/`);
}

export function buildTeacherTeamChangePath(
  teamId: number,
  teamMemberId: number,
  pathname: string,
): string {
  if (
    pathname === TEACHER_QUIZZES_PATH ||
    pathname.startsWith(`${TEACHER_QUIZZES_PATH}/`)
  ) {
    return buildTeacherQuizzesPath(teamId, teamMemberId);
  }
  return buildTeacherPageCanonicalPath(pathname, teamId, teamMemberId);
}

export function buildTeacherPageCanonicalPath(
  pathname: string,
  teamId?: number | null,
  teamMemberId?: number | null,
  extra?: URLSearchParams,
): string {
  if (pathname === TEACHER_PATH) {
    return buildTeacherPath(teamId, teamMemberId);
  }
  if (
    pathname === TEACHER_QUIZZES_PATH ||
    pathname.startsWith(`${TEACHER_QUIZZES_PATH}/`)
  ) {
    return buildTeacherQuizzesPath(teamId, teamMemberId, extra);
  }
  const suffix = pathname.startsWith(TEACHER_PATH)
    ? pathname.slice(TEACHER_PATH.length)
    : pathname;
  const base = buildTeacherSubPath(suffix, teamId, teamMemberId);
  if (!extra || !extra.toString()) {
    return base;
  }
  const p = new URLSearchParams(base.includes("?") ? base.split("?")[1] : "");
  extra.forEach((value, key) => {
    if (!p.has(key)) {
      p.set(key, value);
    }
  });
  const pathOnly = base.split("?")[0] ?? base;
  const qs = p.toString();
  return qs ? `${pathOnly}?${qs}` : pathOnly;
}
