/**
 * Subscriber team admin (`/dashboard/team-admin` and nested routes).
 * URLs use only `team=<workspace id>`; the signed-in user must own or co-admin the team.
 *
 * Primary surfaces: `/members`, `/ws-history`, `/quiz-results`, `/invite-members/send-invite` (and sibling invite URLs including `/invite-members/invitation-history`), Deck Manager under `/deck-manager/…`.
 */

const TEAM_ADMIN_TEAM_PARAM = "team";

/** Primary dashboard — members tab content (`?team=`). */
export const TEAM_ADMIN_MEMBERS_PATH = "/dashboard/team-admin/members";

/** Workspace rename/create/remove history (`?team=`). */
export const TEAM_ADMIN_WS_HISTORY_PATH = "/dashboard/team-admin/ws-history";

/** Member quiz results for the workspace (`?team=`). */
export const TEAM_ADMIN_QUIZ_RESULTS_PATH = "/dashboard/team-admin/quiz-results";

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

/** Deck Manager — move deck between subscriber-owned workspaces (bookmarkable). */
export const TEAM_ADMIN_MOVE_DECK_TO_ANOTHER_WS_PATH =
  "/dashboard/team-admin/deck-manager/move-deck-to-another-ws";

/** True when `pathname` is under Deck Manager (assign or move-deck). */
export function isTeamAdminDeckManagerPath(pathname: string): boolean {
  return pathname.startsWith("/dashboard/team-admin/deck-manager");
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

export function buildTeamAdminSearchParams(teamId?: number | null): string {
  if (teamId == null || !Number.isFinite(teamId) || teamId <= 0) return "";
  const p = new URLSearchParams();
  p.set(TEAM_ADMIN_TEAM_PARAM, String(teamId));
  return p.toString();
}

export function buildTeamAdminMembersPath(teamId?: number | null): string {
  const qs = buildTeamAdminSearchParams(teamId);
  return qs ? `${TEAM_ADMIN_MEMBERS_PATH}?${qs}` : TEAM_ADMIN_MEMBERS_PATH;
}

export function buildTeamAdminWsHistoryPath(teamId?: number | null): string {
  const qs = buildTeamAdminSearchParams(teamId);
  return qs ? `${TEAM_ADMIN_WS_HISTORY_PATH}?${qs}` : TEAM_ADMIN_WS_HISTORY_PATH;
}

export function buildTeamAdminQuizResultsPath(teamId?: number | null): string {
  const qs = buildTeamAdminSearchParams(teamId);
  return qs ? `${TEAM_ADMIN_QUIZ_RESULTS_PATH}?${qs}` : TEAM_ADMIN_QUIZ_RESULTS_PATH;
}

export function buildTeamAdminInviteSendPath(teamId?: number | null): string {
  const qs = buildTeamAdminSearchParams(teamId);
  return qs ? `${TEAM_ADMIN_INVITE_SEND_PATH}?${qs}` : TEAM_ADMIN_INVITE_SEND_PATH;
}

export function buildTeamAdminInvitePendingPath(teamId?: number | null): string {
  const qs = buildTeamAdminSearchParams(teamId);
  return qs ? `${TEAM_ADMIN_INVITE_PENDING_PATH}?${qs}` : TEAM_ADMIN_INVITE_PENDING_PATH;
}

export function buildTeamAdminInviteHistoryPath(teamId?: number | null): string {
  const qs = buildTeamAdminSearchParams(teamId);
  return qs ? `${TEAM_ADMIN_INVITE_HISTORY_PATH}?${qs}` : TEAM_ADMIN_INVITE_HISTORY_PATH;
}

/** Canonical link to the team admin dashboard (members). Alias of {@link buildTeamAdminMembersPath}. */
export function buildTeamAdminPath(teamId?: number | null): string {
  return buildTeamAdminMembersPath(teamId);
}

export function buildTeamAdminAssignDecksToMembersPath(teamId?: number | null): string {
  const qs = buildTeamAdminSearchParams(teamId);
  return qs
    ? `${TEAM_ADMIN_ASSIGN_DECKS_TO_MEMBERS_PATH}?${qs}`
    : TEAM_ADMIN_ASSIGN_DECKS_TO_MEMBERS_PATH;
}

export function buildTeamAdminMoveDeckToAnotherWsPath(teamId?: number | null): string {
  const qs = buildTeamAdminSearchParams(teamId);
  return qs
    ? `${TEAM_ADMIN_MOVE_DECK_TO_ANOTHER_WS_PATH}?${qs}`
    : TEAM_ADMIN_MOVE_DECK_TO_ANOTHER_WS_PATH;
}
