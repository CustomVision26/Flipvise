import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/clerk-auth";
import { getTeamsForTeamDashboard } from "@/db/queries/teams";
import { hasEducationPlan } from "@/lib/education-plans";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import { getAccessContext } from "@/lib/access";
import { personalDashboardPlanQueryValue } from "@/lib/team-plans";
import { TEAM_CONTEXT_COOKIE } from "@/lib/team-context-cookie";
import {
  resolveTeamAdminDashboardSelection,
  type TeamAdminDashboardTeamRow,
} from "@/lib/resolve-team-admin-dashboard-selection";

export type TeamAdminSearchParams = {
  team?: string;
  teamMemberId?: string;
  userid?: string;
  plan?: string;
};

export type TeamAdminPageContext = {
  userId: string;
  selected: TeamAdminDashboardTeamRow;
  teamsForSubscriber: TeamAdminDashboardTeamRow[];
  subscriberTeamIds: number[];
  viewerTeamMemberUrlParam: number;
  isOwner: boolean;
  planLabel: string;
  mainDashboardHref: string;
  workspaceDashboardHref: string;
  showTeacherDashboard: boolean;
};

export async function loadTeamAdminPageContext(
  buildCanonicalPath: (teamId: number, teamMemberUrlParam: number) => string,
  searchParams: Promise<TeamAdminSearchParams>,
): Promise<TeamAdminPageContext> {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const teams = await getTeamsForTeamDashboard(userId);
  if (teams.length === 0) {
    redirect("/onboarding/team");
  }

  const sp = await searchParams;
  const teamMemberIdParam =
    typeof sp.teamMemberId === "string" ? sp.teamMemberId : undefined;
  const useridParam = typeof sp.userid === "string" ? sp.userid : undefined;
  const planParam =
    typeof sp.plan === "string" && sp.plan.trim() !== "" ? sp.plan.trim() : undefined;

  const cookieStore = await cookies();
  const cookieRaw = cookieStore.get(TEAM_CONTEXT_COOKIE)?.value;

  const resolution = await resolveTeamAdminDashboardSelection(teams, {
    viewerUserId: userId,
    teamParam: sp.team,
    teamMemberIdParam,
    cookieTeamRaw: cookieRaw,
    useridParam,
    planParam,
    buildCanonicalPath,
  });
  if (resolution.outcome === "redirect") {
    redirect(resolution.to);
  }

  const { selected, teamsForSubscriber, subscriberTeamIds, viewerTeamMemberUrlParam } =
    resolution;

  const access = await getAccessContext();
  const personalStripeSlug = access.hasClerkPersonalProPlus
    ? ("pro_plus" as const)
    : access.hasClerkPersonalPro
      ? ("pro" as const)
      : null;
  const personalPlanQuery = personalDashboardPlanQueryValue(
    access.activeTeamPlan,
    access.isPro,
    personalStripeSlug,
  );
  const personalDashboardParams = new URLSearchParams({ userid: userId });
  if (personalPlanQuery !== "") personalDashboardParams.set("plan", personalPlanQuery);
  const mainDashboardHref = `/dashboard?${personalDashboardParams.toString()}`;
  const isOwner = selected.ownerUserId === userId;
  // Owners stay on Personal Dash; invited co-admins use `/dashboard?team=`.
  const workspaceDashboardHref = isOwner
    ? mainDashboardHref
    : `/dashboard?${new URLSearchParams({
        team: String(selected.id),
        userid: selected.ownerUserId,
        plan: selected.planSlug,
        teamMemberId: String(viewerTeamMemberUrlParam),
      }).toString()}`;

  return {
    userId,
    selected,
    teamsForSubscriber,
    subscriberTeamIds,
    viewerTeamMemberUrlParam,
    isOwner,
    planLabel: displayNameForBillingPlanSlug(selected.planSlug),
    mainDashboardHref,
    workspaceDashboardHref,
    showTeacherDashboard: hasEducationPlan(selected.planSlug),
  };
}
