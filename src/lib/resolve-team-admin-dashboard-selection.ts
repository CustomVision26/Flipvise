import type { InferSelectModel } from "drizzle-orm";
import type { teams } from "@/db/schema";

export type TeamAdminDashboardTeamRow = InferSelectModel<typeof teams>;

export type ResolveTeamAdminDashboardSelectionResult =
  | { outcome: "redirect"; to: string }
  | {
      outcome: "ok";
      selected: TeamAdminDashboardTeamRow;
      teamsForSubscriber: TeamAdminDashboardTeamRow[];
      subscriberTeamIds: number[];
    };

/**
 * Resolves the active workspace for team-admin routes from `?team=`, team cookie, and legacy params.
 * When the URL is not canonical, returns a redirect target (caller runs `redirect(to)`).
 */
export function resolveTeamAdminDashboardSelection(
  manageTeams: TeamAdminDashboardTeamRow[],
  input: {
    teamParam: string | undefined;
    cookieTeamRaw: string | undefined;
    useridParam?: string;
    planParam?: string;
    buildCanonicalPath: (teamId: number) => string;
  },
): ResolveTeamAdminDashboardSelectionResult {
  const { teamParam, cookieTeamRaw, useridParam, planParam, buildCanonicalPath } = input;

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

  if (hasLegacyUserid || hasLegacyPlan || teamMismatch || missingCanonicalTeamParam) {
    return { outcome: "redirect", to: buildCanonicalPath(selected.id) };
  }

  return {
    outcome: "ok",
    selected,
    teamsForSubscriber,
    subscriberTeamIds,
  };
}
