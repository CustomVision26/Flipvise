"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  isTeamAdminAssignDecksToMembersPath,
  isTeamAdminStudyPrivilegesPath,
} from "@/lib/team-admin-url";
import { teamAdminSubTabClass } from "@/components/team-admin-panel-styles";

export type TeamDeckManagerSubTabsProps = {
  assignDecksHref: string;
  studyPrivilegesHref: string;
};

export function TeamDeckManagerSubTabs({
  assignDecksHref,
  studyPrivilegesHref,
}: TeamDeckManagerSubTabsProps) {
  const pathname = usePathname();
  const assignActive = isTeamAdminAssignDecksToMembersPath(pathname);
  const privilegesActive = isTeamAdminStudyPrivilegesPath(pathname);

  return (
    <div className="overflow-x-auto">
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="inline-flex min-w-full rounded-lg border border-border/80 bg-muted/20 p-1 sm:min-w-0"
      >
        <Link
          href={assignDecksHref}
          className={teamAdminSubTabClass(assignActive)}
          role="tab"
          aria-selected={assignActive}
        >
          Assign decks
        </Link>
        <Link
          href={studyPrivilegesHref}
          className={teamAdminSubTabClass(privilegesActive)}
          role="tab"
          aria-selected={privilegesActive}
        >
          Study privileges
        </Link>
      </div>
    </div>
  );
}
