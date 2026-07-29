import { TeacherTopDashboardButtons } from "@/components/teacher-top-dashboard-buttons";
import { requireTeacherDashboardAccess } from "@/lib/teacher-access";
import { resolveTeacherTopDashboardLinks } from "@/lib/resolve-teacher-top-dashboard-links";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import { cn } from "@/lib/utils";

/** Server-rendered dashboard shortcut bar for every `/teacher/*` page. */
export async function TeacherTopDashboardBar() {
  const { userId } = await requireTeacherDashboardAccess();
  const links = await resolveTeacherTopDashboardLinks(userId);

  return (
    <div
      className={cn(
        teamAdminCardClass,
        "flex flex-col gap-2 rounded-xl border border-border/80 bg-card/80 px-3 py-2.5 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3",
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
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
