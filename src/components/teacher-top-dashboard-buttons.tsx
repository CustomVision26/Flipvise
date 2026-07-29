"use client";

import { MainDashboardButton } from "@/components/main-dashboard-button";
import { cn } from "@/lib/utils";

export function TeacherTopDashboardButtons({
  personalDashboardHref,
  teamDashboardHref,
  teamDashboardTeamId,
  teamAdminHref,
  teamAdminTeamId,
  className,
}: {
  personalDashboardHref: string;
  teamDashboardHref: string | null;
  teamDashboardTeamId: number | null;
  teamAdminHref: string | null;
  teamAdminTeamId: number | null;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <MainDashboardButton
        teamId={null}
        href={personalDashboardHref}
        label="Personal Dashboard"
        trailingArrow
        variant="outline"
        className="h-9 gap-2 font-medium"
      />
      {teamDashboardHref ? (
        <MainDashboardButton
          teamId={teamDashboardTeamId}
          href={teamDashboardHref}
          label="Team Dashboard"
          trailingArrow
          variant="outline"
          className="h-9 gap-2 font-medium"
        />
      ) : null}
      {teamAdminHref ? (
        <MainDashboardButton
          teamId={teamAdminTeamId}
          href={teamAdminHref}
          label="Team Admin Dashboard"
          trailingArrow
          variant="secondary"
          className="h-9 gap-2 font-medium"
        />
      ) : null}
    </div>
  );
}
