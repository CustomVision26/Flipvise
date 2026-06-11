"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  isTeamAdminQuizResultsPath,
  isTeamAdminQuizTimerPath,
} from "@/lib/team-admin-url";
import { teamAdminSubTabClass } from "@/components/team-admin-panel-styles";

export type TeamQuizResultsSubTabsProps = {
  quizResultsHref: string;
  quizTimerHref: string;
};

export function TeamQuizResultsSubTabs({
  quizResultsHref,
  quizTimerHref,
}: TeamQuizResultsSubTabsProps) {
  const pathname = usePathname();
  const resultsActive =
    isTeamAdminQuizResultsPath(pathname) && !isTeamAdminQuizTimerPath(pathname);
  const timerActive = isTeamAdminQuizTimerPath(pathname);

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
      </div>
    </div>
  );
}
