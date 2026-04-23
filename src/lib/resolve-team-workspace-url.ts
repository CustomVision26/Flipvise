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
 * Validates team workspace query params against the signed-in user.
 * `userid` must match the team owner; access is never granted from URL alone.
 */
export async function resolveTeamWorkspaceFromSearchParams(
  userId: string,
  sp: Record<string, string | string[] | undefined>,
): Promise<ResolvedTeamWorkspaceUrl | null> {
  const teamStr = firstString(sp, ["team"]);
  const ownerParam = firstString(sp, ["userid", "userId"]);
  const plan = firstString(sp, ["plan", "Plan"]);

  if (!teamStr || !ownerParam || !plan) return null;
  if (!isWorkspaceSubscriberPlanQueryParam(plan)) return null;

  const teamId = Number(teamStr);
  if (!Number.isFinite(teamId) || teamId <= 0) return null;

  const team = await getTeamById(teamId);
  if (!team || !isTeamPlanId(team.planSlug)) return null;
  if (team.ownerUserId !== ownerParam) return null;

  const planNorm = plan.trim().toLowerCase();
  if (
    isTeamPlanId(planNorm) &&
    planNorm !== team.planSlug.toLowerCase()
  ) {
    return null;
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
 * True only when params look like a full team workspace URL (`team` + owner `userid` + `plan`),
 * so a personal bookmark like `/dashboard?userid=<clerkId>` is not mistaken for a broken team link.
 */
export function searchParamsLooksLikeTeamWorkspace(
  sp: Record<string, string | string[] | undefined>,
): boolean {
  const teamStr = firstString(sp, ["team"]);
  const ownerParam = firstString(sp, ["userid", "userId"]);
  const plan = firstString(sp, ["plan", "Plan"]);
  return teamStr != null && ownerParam != null && plan != null;
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
 * `team` id from the same URL shape `/dashboard` uses for a team workspace link.
 * No DB access — combine with the signed-in user’s allowed workspace ids.
 */
export function teamWorkspaceTeamIdFromUrlShapeIfValid(
  sp: Record<string, string | string[] | undefined>,
): number | null {
  if (!searchParamsLooksLikeTeamWorkspace(sp)) return null;
  const plan = firstString(sp, ["plan", "Plan"]);
  if (!plan || !isWorkspaceSubscriberPlanQueryParam(plan)) return null;
  const teamStr = firstString(sp, ["team"]);
  const teamId = Number(teamStr);
  if (!Number.isFinite(teamId) || teamId <= 0) return null;
  return teamId;
}

/** `userid` without a full team workspace query must match the signed-in user. */
export function shouldRedirectUnauthorizedDashboardUseridParam(
  sessionUserId: string,
  sp: Record<string, string | string[] | undefined>,
): boolean {
  const uid = firstString(sp, ["userid", "userId"]);
  if (!uid) return false;
  if (searchParamsLooksLikeTeamWorkspace(sp)) return false;
  return uid !== sessionUserId;
}

/** Canonical workspace query for the signed-in user (owner → `teamMemberId=0`). */
export async function buildResolvedTeamWorkspaceQueryString(
  userId: string,
  tw: ResolvedTeamWorkspaceUrl,
): Promise<string> {
  let teamMemberUrlParam = 0;
  if (userId !== tw.ownerUserId) {
    const row = await getMemberRecord(tw.teamId, userId);
    teamMemberUrlParam = row?.id ?? 0;
  }
  return buildTeamWorkspaceQueryString({
    teamId: tw.teamId,
    ownerUserId: tw.ownerUserId,
    teamMemberUrlParam,
    plan: tw.workspacePlanQuery,
  });
}
