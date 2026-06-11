/**
 * Subscriber team admin (`/dashboard/team-admin` and nested routes).
 * URLs use `team=<workspace id>` and `teamMemberId=`:
 * - **`teamMemberId=0`** — subscriber / workspace owner: full personal deck library on Personal
 *   Dashboard, every workspace they created, Team Admin for all subscriber-owned workspaces.
 * - **Non-zero** — viewer’s `team_members.id` (invited co-admin or member): Team Admin and nav are
 *   scoped to invited workspaces; on `/dashboard?team=` they only see decks **assigned** to them.
 * The signed-in user must own or co-admin the team.
 *
 * Primary surfaces: `/members`, `/ws-history`, `/quiz-results`, `/invite-members/send-invite` (and sibling invite URLs including `/invite-members/invitation-history`), Deck Manager under `/deck-manager/…`.
 */

const TEAM_ADMIN_TEAM_PARAM = "team";
/** Bookmark param — viewer’s `team_members.id`, or `0` for subscriber owner (matches workspace nav). */
const TEAM_ADMIN_TEAM_MEMBER_PARAM = "teamMemberId";

/** Primary dashboard — members tab content (`?team=`). */
export const TEAM_ADMIN_MEMBERS_PATH = "/dashboard/team-admin/members";

/** Workspace rename/create/remove history (`?team=`). */
export const TEAM_ADMIN_WS_HISTORY_PATH = "/dashboard/team-admin/ws-history";

/** Member quiz results for the workspace (`?team=`). */
export const TEAM_ADMIN_QUIZ_RESULTS_PATH = "/dashboard/team-admin/quiz-results";

/** Quiz timer settings for the workspace (`?team=`). */
export const TEAM_ADMIN_QUIZ_TIMER_PATH = "/dashboard/team-admin/quiz-results/quiz-timer";

/** Quiz security settings and locked sessions (`?team=`). */
export const TEAM_ADMIN_QUIZ_SECURITY_PATH =
  "/dashboard/team-admin/quiz-results/quiz-security";

/** Quiz start date & time settings (`?team=`). */
export const TEAM_ADMIN_QUIZ_SCHEDULE_PATH =
  "/dashboard/team-admin/quiz-results/quiz-schedule";

/** Invite members — send invite form (`?team=`). */
export const TEAM_ADMIN_INVITE_SEND_PATH =
  "/dashboard/team-admin/invite-members/send-invite";

/** Invite members — pending invitations (`?team=`). */
export const TEAM_ADMIN_INVITE_PENDING_PATH =
  "/dashboard/team-admin/invite-members/pending-invitations";

/** Invite members — invitation history (`?team=`). */
export const TEAM_ADMIN_INVITE_HISTORY_PATH =
  "/dashboard/team-admin/invite-members/invitation-history";

/** Legacy segment — redirects to {@link TEAM_ADMIN_INVITE_HISTORY_PATH}. */
export const TEAM_ADMIN_INVITE_HISTORY_LEGACY_PATH =
  "/dashboard/team-admin/invite-members/invite-history";

/** Deck Manager — assign decks to members (bookmarkable). */
export const TEAM_ADMIN_ASSIGN_DECKS_TO_MEMBERS_PATH =
  "/dashboard/team-admin/deck-manager/assign-decks-to-members";

/** Deck Manager — member study mode privileges per assignment. */
export const TEAM_ADMIN_STUDY_PRIVILEGES_PATH =
  "/dashboard/team-admin/deck-manager/study-privileges";

/** True when `pathname` is under Deck Manager. */
export function isTeamAdminDeckManagerPath(pathname: string): boolean {
  return pathname.startsWith("/dashboard/team-admin/deck-manager");
}

export function isTeamAdminAssignDecksToMembersPath(pathname: string): boolean {
  return (
    pathname === TEAM_ADMIN_ASSIGN_DECKS_TO_MEMBERS_PATH ||
    pathname.startsWith(`${TEAM_ADMIN_ASSIGN_DECKS_TO_MEMBERS_PATH}/`)
  );
}

export function isTeamAdminStudyPrivilegesPath(pathname: string): boolean {
  return (
    pathname === TEAM_ADMIN_STUDY_PRIVILEGES_PATH ||
    pathname.startsWith(`${TEAM_ADMIN_STUDY_PRIVILEGES_PATH}/`)
  );
}

/** True when `pathname` is the members team-admin dashboard. */
export function isTeamAdminMembersPath(pathname: string): boolean {
  return pathname === TEAM_ADMIN_MEMBERS_PATH || pathname.startsWith(`${TEAM_ADMIN_MEMBERS_PATH}/`);
}

/** True when `pathname` is the team-admin workspace history route. */
export function isTeamAdminWsHistoryPath(pathname: string): boolean {
  return (
    pathname === TEAM_ADMIN_WS_HISTORY_PATH ||
    pathname.startsWith(`${TEAM_ADMIN_WS_HISTORY_PATH}/`)
  );
}

/** True when `pathname` is the team-admin quiz results route. */
export function isTeamAdminQuizResultsPath(pathname: string): boolean {
  return (
    pathname === TEAM_ADMIN_QUIZ_RESULTS_PATH ||
    pathname.startsWith(`${TEAM_ADMIN_QUIZ_RESULTS_PATH}/`)
  );
}

export function isTeamAdminQuizTimerPath(pathname: string): boolean {
  return (
    pathname === TEAM_ADMIN_QUIZ_TIMER_PATH ||
    pathname.startsWith(`${TEAM_ADMIN_QUIZ_TIMER_PATH}/`)
  );
}

export function isTeamAdminQuizSecurityPath(pathname: string): boolean {
  return (
    pathname === TEAM_ADMIN_QUIZ_SECURITY_PATH ||
    pathname.startsWith(`${TEAM_ADMIN_QUIZ_SECURITY_PATH}/`)
  );
}

export function isTeamAdminQuizSchedulePath(pathname: string): boolean {
  return (
    pathname === TEAM_ADMIN_QUIZ_SCHEDULE_PATH ||
    pathname.startsWith(`${TEAM_ADMIN_QUIZ_SCHEDULE_PATH}/`)
  );
}

/** True when `pathname` is the send-invite route under Invite members. */
export function isTeamAdminInviteSendPath(pathname: string): boolean {
  return (
    pathname === TEAM_ADMIN_INVITE_SEND_PATH ||
    pathname.startsWith(`${TEAM_ADMIN_INVITE_SEND_PATH}/`)
  );
}

/** True when `pathname` is the pending-invitations route under Invite members. */
export function isTeamAdminInvitePendingPath(pathname: string): boolean {
  return (
    pathname === TEAM_ADMIN_INVITE_PENDING_PATH ||
    pathname.startsWith(`${TEAM_ADMIN_INVITE_PENDING_PATH}/`)
  );
}

/** True when `pathname` is the invitation-history route under Invite members. */
export function isTeamAdminInviteHistoryPath(pathname: string): boolean {
  return (
    pathname === TEAM_ADMIN_INVITE_HISTORY_PATH ||
    pathname.startsWith(`${TEAM_ADMIN_INVITE_HISTORY_PATH}/`) ||
    pathname === TEAM_ADMIN_INVITE_HISTORY_LEGACY_PATH ||
    pathname.startsWith(`${TEAM_ADMIN_INVITE_HISTORY_LEGACY_PATH}/`)
  );
}

/** Any bookmarkable Invite members sub-route (send, pending, history). */
export function isTeamAdminInviteMembersSubPath(pathname: string): boolean {
  return (
    isTeamAdminInviteSendPath(pathname) ||
    isTeamAdminInvitePendingPath(pathname) ||
    isTeamAdminInviteHistoryPath(pathname)
  );
}

export function buildTeamAdminQueryString(
  teamId?: number | null,
  teamMemberId?: number | null,
): string {
  const p = new URLSearchParams();
  if (teamId != null && Number.isFinite(teamId) && teamId > 0) {
    p.set(TEAM_ADMIN_TEAM_PARAM, String(teamId));
  }
  if (
    teamMemberId != null &&
    Number.isFinite(teamMemberId) &&
    teamMemberId >= 0
  ) {
    p.set(TEAM_ADMIN_TEAM_MEMBER_PARAM, String(teamMemberId));
  }
  return p.toString();
}

/** Alias for callers that historically only named `team` (+ optional `teamMemberId`). */
export function buildTeamAdminSearchParams(
  teamId?: number | null,
  teamMemberId?: number | null,
): string {
  return buildTeamAdminQueryString(teamId, teamMemberId);
}

export function buildTeamAdminMembersPath(
  teamId?: number | null,
  teamMemberId?: number | null,
): string {
  const qs = buildTeamAdminQueryString(teamId, teamMemberId);
  return qs ? `${TEAM_ADMIN_MEMBERS_PATH}?${qs}` : TEAM_ADMIN_MEMBERS_PATH;
}

export function buildTeamAdminWsHistoryPath(
  teamId?: number | null,
  teamMemberId?: number | null,
): string {
  const qs = buildTeamAdminQueryString(teamId, teamMemberId);
  return qs ? `${TEAM_ADMIN_WS_HISTORY_PATH}?${qs}` : TEAM_ADMIN_WS_HISTORY_PATH;
}

export function buildTeamAdminQuizResultsPath(
  teamId?: number | null,
  teamMemberId?: number | null,
): string {
  const qs = buildTeamAdminQueryString(teamId, teamMemberId);
  return qs ? `${TEAM_ADMIN_QUIZ_RESULTS_PATH}?${qs}` : TEAM_ADMIN_QUIZ_RESULTS_PATH;
}

export function buildTeamAdminQuizTimerPath(
  teamId?: number | null,
  teamMemberId?: number | null,
): string {
  const qs = buildTeamAdminQueryString(teamId, teamMemberId);
  return qs ? `${TEAM_ADMIN_QUIZ_TIMER_PATH}?${qs}` : TEAM_ADMIN_QUIZ_TIMER_PATH;
}

export function buildTeamAdminQuizSecurityPath(
  teamId?: number | null,
  teamMemberId?: number | null,
): string {
  const qs = buildTeamAdminQueryString(teamId, teamMemberId);
  return qs ? `${TEAM_ADMIN_QUIZ_SECURITY_PATH}?${qs}` : TEAM_ADMIN_QUIZ_SECURITY_PATH;
}

export function buildTeamAdminQuizSchedulePath(
  teamId?: number | null,
  teamMemberId?: number | null,
): string {
  const qs = buildTeamAdminQueryString(teamId, teamMemberId);
  return qs ? `${TEAM_ADMIN_QUIZ_SCHEDULE_PATH}?${qs}` : TEAM_ADMIN_QUIZ_SCHEDULE_PATH;
}

export function buildTeamAdminInviteSendPath(
  teamId?: number | null,
  teamMemberId?: number | null,
): string {
  const qs = buildTeamAdminQueryString(teamId, teamMemberId);
  return qs ? `${TEAM_ADMIN_INVITE_SEND_PATH}?${qs}` : TEAM_ADMIN_INVITE_SEND_PATH;
}

export function buildTeamAdminInvitePendingPath(
  teamId?: number | null,
  teamMemberId?: number | null,
): string {
  const qs = buildTeamAdminQueryString(teamId, teamMemberId);
  return qs
    ? `${TEAM_ADMIN_INVITE_PENDING_PATH}?${qs}`
    : TEAM_ADMIN_INVITE_PENDING_PATH;
}

export function buildTeamAdminInviteHistoryPath(
  teamId?: number | null,
  teamMemberId?: number | null,
): string {
  const qs = buildTeamAdminQueryString(teamId, teamMemberId);
  return qs
    ? `${TEAM_ADMIN_INVITE_HISTORY_PATH}?${qs}`
    : TEAM_ADMIN_INVITE_HISTORY_PATH;
}

/** Canonical link to the team admin dashboard (members). */
export function buildTeamAdminPath(
  teamId?: number | null,
  teamMemberId?: number | null,
): string {
  return buildTeamAdminMembersPath(teamId, teamMemberId);
}

export function buildTeamAdminAssignDecksToMembersPath(
  teamId?: number | null,
  teamMemberId?: number | null,
): string {
  const qs = buildTeamAdminQueryString(teamId, teamMemberId);
  return qs
    ? `${TEAM_ADMIN_ASSIGN_DECKS_TO_MEMBERS_PATH}?${qs}`
    : TEAM_ADMIN_ASSIGN_DECKS_TO_MEMBERS_PATH;
}

export function buildTeamAdminStudyPrivilegesPath(
  teamId?: number | null,
  teamMemberId?: number | null,
): string {
  const qs = buildTeamAdminQueryString(teamId, teamMemberId);
  return qs ? `${TEAM_ADMIN_STUDY_PRIVILEGES_PATH}?${qs}` : TEAM_ADMIN_STUDY_PRIVILEGES_PATH;
}
