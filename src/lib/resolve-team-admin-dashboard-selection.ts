import type { InferSelectModel } from "drizzle-orm";
import type { teams } from "@/db/schema";
import { getMemberRecord } from "@/db/queries/teams";

export type TeamAdminDashboardTeamRow = InferSelectModel<typeof teams>;

export type ResolveTeamAdminDashboardSelectionResult =
  | { outcome: "redirect"; to: string }
  | {
      outcome: "ok";
      selected: TeamAdminDashboardTeamRow;
      teamsForSubscriber: TeamAdminDashboardTeamRow[];
      subscriberTeamIds: number[];
      /** `0` when the viewer is the workspace/subscriber owner; else `team_members.id` for invited roles. */
      viewerTeamMemberUrlParam: number;
    };

/** `0` = subscriber owner (full personal library + all owned workspaces); non-zero = invited row id. */
export async function teamMemberUrlParamForTeamAdmin(
  team: TeamAdminDashboardTeamRow,
  viewerUserId: string,
): Promise<number> {
  if (team.ownerUserId === viewerUserId) return 0;
  const row = await getMemberRecord(team.id, viewerUserId);
  return row?.id ?? 0;
}

function parseTeamMemberIdQuery(raw: string | undefined): number | null {
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Resolves the active workspace for team-admin routes from `?team=`, `?teamMemberId=`, cookie, and legacy params.
 * When the URL is not canonical, returns a redirect target (caller runs `redirect(to)`).
 */
export async function resolveTeamAdminDashboardSelection(
  manageTeams: TeamAdminDashboardTeamRow[],
  input: {
    viewerUserId: string;
    teamParam: string | undefined;
    teamMemberIdParam?: string | undefined;
    cookieTeamRaw: string | undefined;
    useridParam?: string;
    planParam?: string;
    buildCanonicalPath: (teamId: number, teamMemberUrlParam: number) => string;
  },
): Promise<ResolveTeamAdminDashboardSelectionResult> {
  const {
    viewerUserId,
    teamParam,
    teamMemberIdParam,
    cookieTeamRaw,
    useridParam,
    planParam,
    buildCanonicalPath,
  } = input;

  const rawFromQuery =
    teamParam != null && teamParam !== "" && !Number.isNaN(Number(teamParam))
      ? Number(teamParam)
      : NaN;

  const teamIdSet = new Set(manageTeams.map((t) => t.id));
  const fromQuery =
    Number.isFinite(rawFromQuery) && teamIdSet.has(rawFromQuery)
      ? manageTeams.find((t) => t.id === rawFromQuery)
      : undefined;

  const rawFromCookie =
    cookieTeamRaw != null &&
    cookieTeamRaw !== "" &&
    !Number.isNaN(Number(cookieTeamRaw))
      ? Number(cookieTeamRaw)
      : NaN;
  const fromCookie =
    Number.isFinite(rawFromCookie) && teamIdSet.has(rawFromCookie)
      ? manageTeams.find((t) => t.id === rawFromCookie)
      : undefined;

  const selected = fromQuery ?? fromCookie ?? manageTeams[0] ?? null;
  if (!selected) {
    throw new Error("resolveTeamAdminDashboardSelection: empty manageTeams");
  }

  const subscriberForWorkspace = selected.ownerUserId;
  const teamsForSubscriber = manageTeams.filter(
    (t) => t.ownerUserId === subscriberForWorkspace,
  );
  const subscriberTeamIds = teamsForSubscriber.map((t) => t.id);

  const parsedTeamFromUrl =
    Number.isFinite(rawFromQuery) && teamIdSet.has(rawFromQuery) ? rawFromQuery : null;
  const hasLegacyUserid = Boolean(useridParam?.trim());
  const hasLegacyPlan = Boolean(planParam);
  const teamMismatch =
    parsedTeamFromUrl !== null && parsedTeamFromUrl !== selected.id;
  const missingCanonicalTeamParam = parsedTeamFromUrl === null;

  const expectedTeamMemberId = await teamMemberUrlParamForTeamAdmin(
    selected,
    viewerUserId,
  );
  const parsedTeamMemberFromUrl = parseTeamMemberIdQuery(teamMemberIdParam);
  const missingOrMismatchTeamMember =
    parsedTeamMemberFromUrl === null ||
    parsedTeamMemberFromUrl !== expectedTeamMemberId;

  if (
    hasLegacyUserid ||
    hasLegacyPlan ||
    teamMismatch ||
    missingCanonicalTeamParam ||
    missingOrMismatchTeamMember
  ) {
    return {
      outcome: "redirect",
      to: buildCanonicalPath(selected.id, expectedTeamMemberId),
    };
  }

  return {
    outcome: "ok",
    selected,
    teamsForSubscriber,
    subscriberTeamIds,
    viewerTeamMemberUrlParam: expectedTeamMemberId,
  };
}
