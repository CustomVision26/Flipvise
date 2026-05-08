import { redirect } from "next/navigation";
import { auth } from "@/lib/clerk-auth";
import { getTeamById } from "@/db/queries/teams";
import { buildTeamAdminPath } from "@/lib/team-admin-url";
import { teamMemberUrlParamForTeamAdmin } from "@/lib/resolve-team-admin-dashboard-selection";

/**
 * Legacy URL — team admin dashboard moved to `/dashboard/team-admin`.
 */
export default async function LegacyTeamDashboardRedirect({
  searchParams,
}: {
  searchParams: Promise<{ team?: string | string[] }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const sp = await searchParams;
  const raw = sp.team;
  const team =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw) && raw[0] != null
        ? raw[0]
        : "";
  if (team !== "") {
    const teamNum = Number(team);
    if (Number.isFinite(teamNum) && !Number.isNaN(teamNum)) {
      const row = await getTeamById(teamNum);
      if (row) {
        const tm = await teamMemberUrlParamForTeamAdmin(row, userId);
        redirect(buildTeamAdminPath(teamNum, tm));
      }
    }
    redirect(buildTeamAdminPath());
  }
  redirect(buildTeamAdminPath());
}
