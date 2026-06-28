import { getMemberRecord, getTeamById, teamWorkspaceAllowsViewerAccess } from "@/db/queries/teams";
import {
  canonicalTeamPlanId,
  isTeamPlanId,
  isWorkspaceSubscriberPlanQueryParam,
} from "@/lib/team-plans";
import { TEAM_WORKSPACE_QUERY } from "@/lib/team-workspace-url";

export type ResolvedTeamWorkspaceUrl = {
  teamId: number;
  ownerUserId: string;
  /**
   * Subscriber/workspace owner — may open and edit workspace decks on `/dashboard?team=`.
   */
  canEditTeamDecks: boolean;
  /**
   * Invited `team_member` — `/dashboard?team=` shows only decks assigned to them (study/preview).
   */
  isAssignedMemberPreview: boolean;
  /**
   * Invited `team_admin` — `/dashboard?team=` shows only decks assigned to them for study.
   * Deck linking and member assignment use `/dashboard/team-admin` (URLs use `teamMemberId`; `0` = owner).
   */
  isTeamAdminWorkspaceViewer: boolean;
  /** Canonical `plan=` for workspace URLs — matches DB team tier when applicable. */
  workspacePlanQuery: string;
};

function firstString(
  sp: Record<string, string | string[] | undefined>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const v = sp[key];
    const x = Array.isArray(v) ? v[0] : v;
    if (x != null && String(x).trim() !== "") return String(x).trim();
  }
  return undefined;
}

/**
 * Validates team workspace access: `team` id plus optional legacy `userid` / `plan`
 * (when present they must match the DB). Access is never granted from URL alone —
 * membership is checked for non-owners.
 */
export async function resolveTeamWorkspaceFromSearchParams(
  userId: string,
  sp: Record<string, string | string[] | undefined>,
): Promise<ResolvedTeamWorkspaceUrl | null> {
  const teamStr = firstString(sp, ["team"]);
  if (!teamStr) return null;

  const teamId = Number(teamStr);
  if (!Number.isFinite(teamId) || teamId <= 0) return null;

  const team = await getTeamById(teamId);
  if (!team || !isTeamPlanId(team.planSlug)) return null;

  const ownerParam = firstString(sp, ["userid", "userId"]);
  const plan = firstString(sp, ["plan", "Plan"]);

  if (ownerParam != null && team.ownerUserId !== ownerParam) return null;

  if (plan != null) {
    if (!isWorkspaceSubscriberPlanQueryParam(plan)) return null;
    const planNorm = plan.trim().toLowerCase();
    if (isTeamPlanId(planNorm)) {
      const urlTeamPlan = canonicalTeamPlanId(planNorm);
      const dbTeamPlan = canonicalTeamPlanId(team.planSlug);
      if (
        urlTeamPlan == null ||
        dbTeamPlan == null ||
        urlTeamPlan !== dbTeamPlan
      ) {
        return null;
      }
    }
  }

  const workspacePlanQuery = team.planSlug;

  if (!(await teamWorkspaceAllowsViewerAccess(teamId, userId))) {
    return null;
  }

  if (team.ownerUserId === userId) {
    return {
      teamId,
      ownerUserId: team.ownerUserId,
      canEditTeamDecks: true,
      isAssignedMemberPreview: false,
      isTeamAdminWorkspaceViewer: false,
      workspacePlanQuery,
    };
  }

  const member = await getMemberRecord(teamId, userId);
  if (!member) return null;

  if (member.role === "team_admin") {
    return {
      teamId,
      ownerUserId: team.ownerUserId,
      canEditTeamDecks: false,
      isAssignedMemberPreview: false,
      isTeamAdminWorkspaceViewer: true,
      workspacePlanQuery,
    };
  }

  return {
    teamId,
    ownerUserId: team.ownerUserId,
    canEditTeamDecks: false,
    isAssignedMemberPreview: true,
    isTeamAdminWorkspaceViewer: false,
    workspacePlanQuery,
  };
}

/**
 * True when a `team` query is present and numeric (workspace or invalid attempt).
 * Used so `/dashboard?team=…` is not confused with personal-dashboard query cleanup.
 */
export function searchParamsLooksLikeTeamWorkspace(
  sp: Record<string, string | string[] | undefined>,
): boolean {
  const teamStr = firstString(sp, ["team"]);
  if (!teamStr) return false;
  const teamId = Number(teamStr);
  return Number.isFinite(teamId) && teamId > 0;
}

/**
 * Workspace URLs may include `userid`, `plan`, and `teamMemberId` alongside `team`
 * (bookmark shape). Deck/dashboard handlers normalize to the full query when needed.
 */
export function teamWorkspaceSearchParamsHaveLegacyIdentityFields(
  sp: Record<string, string | string[] | undefined>,
): boolean {
  if (!searchParamsLooksLikeTeamWorkspace(sp)) return false;
  return (
    firstString(sp, ["userid", "userId"]) != null ||
    firstString(sp, ["plan", "Plan"]) != null ||
    firstString(sp, ["teamMemberId"]) != null
  );
}

/**
 * If the URL carries `userid` / `plan` without a `team` workspace query, return a path
 * with those removed. Preserves other params such as `team_invite=accepted`.
 * When `viewerUserId` is set and matches `userid` / `userId`, no redirect is applied (intentional in-app links).
 * Returns `null` when no redirect is needed.
 */
export function canonicalDashboardPathRemovingSensitiveQuery(
  sp: Record<string, string | string[] | undefined>,
  viewerUserId?: string,
): string | null {
  if (searchParamsLooksLikeTeamWorkspace(sp)) return null;
  const uid = firstString(sp, ["userid", "userId"]);
  const hasUid = uid != null;
  const hasPlan = firstString(sp, ["plan", "Plan"]) != null;
  if (!hasUid && !hasPlan) return null;
  if (
    viewerUserId != null &&
    uid != null &&
    uid === viewerUserId
  ) {
    return null;
  }
  const next = new URLSearchParams();
  const teamInvite = firstString(sp, ["team_invite"]);
  if (teamInvite) next.set("team_invite", teamInvite);
  return next.toString() ? `/dashboard?${next.toString()}` : "/dashboard";
}

/** Parses a request query string (e.g. `proxy` `x-search` header: `?team=1&…`). */
export function parseSearchParamsRecordFromSearchString(
  searchRaw: string,
): Record<string, string | string[] | undefined> {
  const trimmed = searchRaw.trim();
  const qs = trimmed.startsWith("?") ? trimmed.slice(1) : trimmed;
  if (qs === "") return {};
  const params = new URLSearchParams(qs);
  const out: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    out[key] = value;
  }
  return out;
}

/**
 * `team` id from workspace URLs (`/dashboard`, `/decks/...`). No DB access —
 * combine with the signed-in user’s allowed workspace ids in the layout.
 */
export function teamWorkspaceTeamIdFromUrlShapeIfValid(
  sp: Record<string, string | string[] | undefined>,
): number | null {
  if (!searchParamsLooksLikeTeamWorkspace(sp)) return null;
  const teamStr = firstString(sp, ["team"]);
  const teamId = Number(teamStr);
  if (!Number.isFinite(teamId) || teamId <= 0) return null;
  return teamId;
}

/** `userid` without a `team=` workspace query must match the signed-in user. */
export function shouldRedirectUnauthorizedDashboardUseridParam(
  sessionUserId: string,
  sp: Record<string, string | string[] | undefined>,
): boolean {
  const uid = firstString(sp, ["userid", "userId"]);
  if (!uid) return false;
  if (searchParamsLooksLikeTeamWorkspace(sp)) return false;
  return uid !== sessionUserId;
}

/** Canonical workspace query for deck/study/dashboard links. */
export async function buildResolvedTeamWorkspaceQueryString(
  viewerUserId: string,
  tw: ResolvedTeamWorkspaceUrl,
): Promise<string> {
  let teamMemberUrlParam = 0;
  if (tw.ownerUserId !== viewerUserId) {
    const member = await getMemberRecord(tw.teamId, viewerUserId);
    teamMemberUrlParam = member?.id ?? 0;
  }
  const p = new URLSearchParams();
  p.set(TEAM_WORKSPACE_QUERY.team, String(tw.teamId));
  p.set(TEAM_WORKSPACE_QUERY.userid, tw.ownerUserId);
  p.set(TEAM_WORKSPACE_QUERY.plan, tw.workspacePlanQuery);
  p.set(TEAM_WORKSPACE_QUERY.teamMemberId, String(teamMemberUrlParam));
  return p.toString();
}

/** Identity fields from the current URL in canonical key order (for redirect comparison). */
function teamWorkspaceIdentityQueryFromSearchParams(
  sp: Record<string, string | string[] | undefined>,
): string {
  const p = new URLSearchParams();
  const team = firstString(sp, ["team"]);
  if (team) p.set(TEAM_WORKSPACE_QUERY.team, team);
  const userid = firstString(sp, ["userid", "userId"]);
  if (userid) p.set(TEAM_WORKSPACE_QUERY.userid, userid);
  const plan = firstString(sp, ["plan", "Plan"]);
  if (plan) p.set(TEAM_WORKSPACE_QUERY.plan, plan);
  const teamMemberId = firstString(sp, ["teamMemberId"]);
  if (teamMemberId) p.set(TEAM_WORKSPACE_QUERY.teamMemberId, teamMemberId);
  return p.toString();
}

/**
 * When workspace identity query fields are present but stale or partial, returns the
 * canonical query string. When the URL is already canonical, returns `null` (no redirect).
 */
export async function resolveTeamWorkspaceCanonicalRedirectQueryString(
  viewerUserId: string,
  sp: Record<string, string | string[] | undefined>,
  tw: ResolvedTeamWorkspaceUrl,
): Promise<string | null> {
  if (!teamWorkspaceSearchParamsHaveLegacyIdentityFields(sp)) return null;
  const canonical = await buildResolvedTeamWorkspaceQueryString(viewerUserId, tw);
  if (teamWorkspaceIdentityQueryFromSearchParams(sp) === canonical) return null;
  return canonical;
}
