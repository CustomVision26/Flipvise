import { cookies } from "next/headers";
import { auth } from "@/lib/clerk-auth";
import { redirect } from "next/navigation";
import { TEAM_CONTEXT_COOKIE } from "@/lib/team-context-cookie";
import { getTeamsForTeamDashboard } from "@/db/queries/teams";
import { buildTeamAdminMembersPath } from "@/lib/team-admin-url";
import { resolveTeamAdminDashboardSelection } from "@/lib/resolve-team-admin-dashboard-selection";

interface PageProps {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
    userid?: string;
    plan?: string;
  }>;
}

/**
 * `/dashboard/team-admin` entry — resolves workspace context and redirects to
 * `/dashboard/team-admin/members?team=`.
 *
 * **Workspace main dashboard** (for co-admins; hidden for the subscriber owner) uses:
 * `/dashboard?team=<workspaceId>&userid=<ownerClerkId>&plan=<team.planSlug>&teamMemberId=<viewerRowId>`
 *
 * Quick navigation with Personal dashboard, plan badge, and “To workspace” lives in
 * `team-admin-dashboard-view.tsx` and deck-manager pages.
 */
export default async function TeamAdminDashboardRootPage({ searchParams }: PageProps) {
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
    buildCanonicalPath: buildTeamAdminMembersPath,
  });
  if (resolution.outcome === "redirect") {
    redirect(resolution.to);
  }
  redirect(
    buildTeamAdminMembersPath(
      resolution.selected.id,
      resolution.viewerTeamMemberUrlParam,
    ),
  );
}
