import { cookies } from "next/headers";
import { auth } from "@/lib/clerk-auth";
import { redirect } from "next/navigation";
import { TEAM_CONTEXT_COOKIE } from "@/lib/team-context-cookie";
import { getTeamsForTeamDashboard } from "@/db/queries/teams";
import { buildTeamAdminAssignDecksToMembersPath } from "@/lib/team-admin-url";
import { resolveTeamAdminDashboardSelection } from "@/lib/resolve-team-admin-dashboard-selection";

interface PageProps {
  searchParams: Promise<{ team?: string; userid?: string; plan?: string }>;
}

/**
 * `/dashboard/team-admin` entry — resolves workspace context and redirects to
 * `/dashboard/team-admin/deck-manager/assign-decks-to-members?team=`.
 */
export default async function TeamAdminDashboardRootPage({ searchParams }: PageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const teams = await getTeamsForTeamDashboard(userId);
  if (teams.length === 0) {
    redirect("/onboarding/team");
  }

  const sp = await searchParams;
  const useridParam = typeof sp.userid === "string" ? sp.userid : undefined;
  const planParam =
    typeof sp.plan === "string" && sp.plan.trim() !== "" ? sp.plan.trim() : undefined;

  const cookieStore = await cookies();
  const cookieRaw = cookieStore.get(TEAM_CONTEXT_COOKIE)?.value;

  const resolution = resolveTeamAdminDashboardSelection(teams, {
    teamParam: sp.team,
    cookieTeamRaw: cookieRaw,
    useridParam,
    planParam,
    buildCanonicalPath: buildTeamAdminAssignDecksToMembersPath,
  });
  if (resolution.outcome === "redirect") {
    redirect(resolution.to);
  }
  redirect(buildTeamAdminAssignDecksToMembersPath(resolution.selected.id));
}
