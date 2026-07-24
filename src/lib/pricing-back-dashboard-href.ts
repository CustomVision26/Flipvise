import type { TeamPlanId } from "@/lib/team-plans";
import { cookies } from "next/headers";
import { getWorkspaceNavTeamsForUser } from "@/db/queries/teams";
import { TEAM_CONTEXT_COOKIE } from "@/lib/team-context-cookie";
import { buildTeamWorkspaceDashboardPath } from "@/lib/team-workspace-url";
import { personalDashboardHrefWithUserPlanQuery } from "@/lib/personal-dashboard-url";
import { tryTeamQuery } from "@/lib/team-query-fallback";

/**
 * “Back to Dashboard” on `/pricing`: matches header workspace switcher — team cookie + nav row →
 * `/dashboard?team=&userid=&plan=&teamMemberId=`; otherwise personal `?userid=&plan=`.
 */
export async function resolvePricingBackToDashboardHref(input: {
  userId: string;
  activeTeamPlan: TeamPlanId | null;
  isPro: boolean;
  hasClerkPersonalPro: boolean;
  hasClerkPersonalProPlus: boolean;
}): Promise<string> {
  const personal = personalDashboardHrefWithUserPlanQuery({
    userId: input.userId,
    activeTeamPlan: input.activeTeamPlan,
    isPro: input.isPro,
    hasClerkPersonalPro: input.hasClerkPersonalPro,
    hasClerkPersonalProPlus: input.hasClerkPersonalProPlus,
  });

  const cookieStore = await cookies();
  const raw = cookieStore.get(TEAM_CONTEXT_COOKIE)?.value;
  const teamId = raw ? Number(raw) : NaN;
  if (!Number.isFinite(teamId) || teamId <= 0) return personal;

  const { teams } = await tryTeamQuery(
    () =>
      getWorkspaceNavTeamsForUser(input.userId, {
        personalProUnlocked: input.isPro,
      }),
    { teams: [], totalEligibleCount: 0 },
  );
  const selected = teams.find((t) => t.id === teamId);
  if (!selected || selected.isSubscriberOwned) return personal;

  return buildTeamWorkspaceDashboardPath({
    teamId: selected.id,
    ownerUserId: selected.ownerUserId,
    planSlug: selected.planUrlValue,
    teamMemberUrlParam: selected.teamMemberUrlParam,
  });
}
