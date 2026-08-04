/** Live Classroom™ routes under `/dashboard/live-classroom`. */

export const LIVE_CLASSROOM_ROOT_PATH = "/dashboard/live-classroom";
export const LIVE_CLASSROOM_START_PATH = "/dashboard/live-classroom/start";
export const LIVE_CLASSROOM_JOIN_PATH = "/dashboard/live-classroom/join";
export const LIVE_CLASSROOM_SCHEDULED_PATH =
  "/dashboard/live-classroom/scheduled";
export const LIVE_CLASSROOM_HISTORY_PATH = "/dashboard/live-classroom/history";
export const LIVE_CLASSROOM_REPORTS_PATH = "/dashboard/live-classroom/reports";
export const LIVE_CLASSROOM_SETTINGS_PATH = "/dashboard/live-classroom/settings";

export function liveClassroomSessionPath(sessionId: number): string {
  return `${LIVE_CLASSROOM_ROOT_PATH}/session/${sessionId}`;
}

export function liveClassroomLobbyPath(sessionId: number): string {
  return `${liveClassroomSessionPath(sessionId)}/lobby`;
}

export function liveClassroomHostPath(sessionId: number): string {
  return `${liveClassroomSessionPath(sessionId)}/host`;
}

export function liveClassroomPlayPath(sessionId: number): string {
  return `${liveClassroomSessionPath(sessionId)}/play`;
}

export function liveClassroomProjectorPath(sessionId: number): string {
  return `${liveClassroomSessionPath(sessionId)}/projector`;
}

export function liveClassroomReportPath(sessionId: number): string {
  return `${LIVE_CLASSROOM_REPORTS_PATH}/${sessionId}`;
}

export function isLiveClassroomPath(pathname: string): boolean {
  return (
    pathname === LIVE_CLASSROOM_ROOT_PATH ||
    pathname.startsWith(`${LIVE_CLASSROOM_ROOT_PATH}/`)
  );
}

export function buildLiveClassroomHref(
  path: string,
  teamId?: number | null,
): string {
  if (teamId == null || !Number.isFinite(teamId) || teamId <= 0) return path;
  const p = new URLSearchParams({ team: String(teamId) });
  return `${path}?${p.toString()}`;
}
