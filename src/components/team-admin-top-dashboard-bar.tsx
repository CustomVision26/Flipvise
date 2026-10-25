import { TeacherTopDashboardButtons } from "@/components/teacher-top-dashboard-buttons";
import { resolveTeamAdminTopDashboardLinks } from "@/lib/resolve-team-admin-top-dashboard-links";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/clerk-auth";

/** Server-rendered dashboard shortcut bar for every `/dashboard/team-admin/*` page. */
export async function TeamAdminTopDashboardBar() {
  const { userId } = await auth();
  if (!userId) return null;

  const links = await resolveTeamAdminTopDashboardLinks(userId);

  return (
    <div
      className={cn(
        teamAdminCardClass,
        "flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3",
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        Dashboards
      </p>
      <TeacherTopDashboardButtons
        personalDashboardHref={links.personalDashboardHref}
        teamDashboardHref={links.teamDashboardHref}
        teamDashboardTeamId={links.teamDashboardTeamId}
        teamAdminHref={links.teamAdminHref}
        teamAdminTeamId={links.teamAdminTeamId}
      />
    </div>
  );
}
