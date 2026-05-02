import { getMemberRecord, getTeamById } from "@/db/queries/teams";
import { isTeamPlanId, isWorkspaceSubscriberPlanQueryParam } from "@/lib/team-plans";
import { buildTeamWorkspaceQueryString } from "@/lib/team-workspace-url";

export type ResolvedTeamWorkspaceUrl = {
  teamId: number;
  ownerUserId: string;
  /** Owner or `team_admin` — full deck/study/deck editor access. */
  canEditTeamDecks: boolean;
  /** `team_member` role — dashboard/study are read-oriented; deck editor is blocked. */
  isAssignedMemberPreview: boolean;
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
    if (isTeamPlanId(planNorm) && planNorm !== team.planSlug.toLowerCase()) {
      return null;
    }
  }

  const workspacePlanQuery = team.planSlug;

  if (team.ownerUserId === userId) {
    return {
      teamId,
      ownerUserId: team.ownerUserId,
      canEditTeamDecks: true,
      isAssignedMemberPreview: false,
      workspacePlanQuery,
    };
  }

  const member = await getMemberRecord(teamId, userId);
  if (!member) return null;

  if (member.role === "team_admin") {
    return {
      teamId,
      ownerUserId: team.ownerUserId,
      canEditTeamDecks: true,
      isAssignedMemberPreview: false,
      workspacePlanQuery,
    };
  }

  return {
    teamId,
    ownerUserId: team.ownerUserId,
    canEditTeamDecks: false,
    isAssignedMemberPreview: true,
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
 * Legacy workspace URLs included `userid`, `plan`, and `teamMemberId`. When present
 * alongside `team`, redirect to the minimal `?team=` URL after a successful resolve.
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
 * Returns `null` when no redirect is needed.
 */
export function canonicalDashboardPathRemovingSensitiveQuery(
  sp: Record<string, string | string[] | undefined>,
): string | null {
  if (searchParamsLooksLikeTeamWorkspace(sp)) return null;
  const hasUid = firstString(sp, ["userid", "userId"]) != null;
  const hasPlan = firstString(sp, ["plan", "Plan"]) != null;
  if (!hasUid && !hasPlan) return null;
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

/** Canonical workspace query for deck/study/dashboard links — `team` only. */
export async function buildResolvedTeamWorkspaceQueryString(
  userId: string,
  tw: ResolvedTeamWorkspaceUrl,
): Promise<string> {
  void userId;
  return buildTeamWorkspaceQueryString({ teamId: tw.teamId });
}
