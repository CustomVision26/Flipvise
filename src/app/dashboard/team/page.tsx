import { redirect } from "next/navigation";
import { auth } from "@/lib/clerk-auth";
import { getTeamById } from "@/db/queries/teams";
import { isTeamPlanId } from "@/lib/team-plans";
import { buildTeamAdminPath } from "@/lib/team-admin-url";

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
      const plan =
        row != null && isTeamPlanId(row.planSlug) ? row.planSlug : undefined;
      redirect(buildTeamAdminPath(teamNum));
    }
    redirect(buildTeamAdminPath());
  }
  redirect(buildTeamAdminPath());
}
