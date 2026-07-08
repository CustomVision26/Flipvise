"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  isTeamAdminQuizResultsPath,
  isTeamAdminQuizSchedulePath,
  isTeamAdminQuizSecurityPath,
  isTeamAdminQuizTimerPath,
} from "@/lib/team-admin-url";
import { TEAM_ADMIN_SIDEBAR_NAV_ENABLED } from "@/lib/team-admin-dashboard-nav";
import { teamAdminSubTabClass } from "@/components/team-admin-panel-styles";

export type TeamQuizResultsSubTabsProps = {
  quizResultsHref: string;
  quizTimerHref: string;
  quizScheduleHref: string;
  quizSecurityHref: string;
};

export function TeamQuizResultsSubTabs({
  quizResultsHref,
  quizTimerHref,
  quizScheduleHref,
  quizSecurityHref,
}: TeamQuizResultsSubTabsProps) {
  const pathname = usePathname();
  if (TEAM_ADMIN_SIDEBAR_NAV_ENABLED) {
    return null;
  }

  const onQuizResultsSubRoute =
    isTeamAdminQuizTimerPath(pathname) ||
    isTeamAdminQuizSchedulePath(pathname) ||
    isTeamAdminQuizSecurityPath(pathname);
  const resultsActive = isTeamAdminQuizResultsPath(pathname) && !onQuizResultsSubRoute;
  const timerActive = isTeamAdminQuizTimerPath(pathname);
  const scheduleActive = isTeamAdminQuizSchedulePath(pathname);
  const securityActive = isTeamAdminQuizSecurityPath(pathname);

  return (
    <div className="overflow-x-auto">
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="inline-flex min-w-full rounded-lg border border-border/80 bg-muted/20 p-1 sm:min-w-0"
      >
        <Link
          href={quizResultsHref}
          className={teamAdminSubTabClass(resultsActive)}
          role="tab"
          aria-selected={resultsActive}
        >
          Results
        </Link>
        <Link
          href={quizTimerHref}
          className={teamAdminSubTabClass(timerActive)}
          role="tab"
          aria-selected={timerActive}
        >
          Quiz timer
        </Link>
        <Link
          href={quizScheduleHref}
          className={teamAdminSubTabClass(scheduleActive)}
          role="tab"
          aria-selected={scheduleActive}
        >
          Quiz schedule
        </Link>
        <Link
          href={quizSecurityHref}
          className={teamAdminSubTabClass(securityActive)}
          role="tab"
          aria-selected={securityActive}
        >
          Quiz security
        </Link>
      </div>
    </div>
  );
}
