"use client";

import { Suspense, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { TeamSwitcherDropdown } from "@/components/team-switcher-dropdown";

export type TeamAdminHeaderSwitcherTeam = {
  id: number;
  name: string;
  ownerUserId: string;
  /** Clerk team plan id for that workspace’s row — UI only; team-admin URLs use `?team=` only. */
  workspacePlanQuery?: string;
};

/**
 * Scope the team-admin switcher: when `?team=` is set, only teams owned by that
 * workspace’s subscriber; otherwise fall back to legacy `userid=` or single-owner list.
 */
function teamAdminWorkspaceTeamsForUrl(
  teams: TeamAdminHeaderSwitcherTeam[],
  userId: string,
  searchParams: URLSearchParams,
): TeamAdminHeaderSwitcherTeam[] {
  const rawTeam = searchParams.get("team")?.trim();
  const teamIdFromUrl = rawTeam ? Number(rawTeam) : NaN;
  if (Number.isFinite(teamIdFromUrl) && teamIdFromUrl > 0) {
    const anchor = teams.find((t) => t.id === teamIdFromUrl);
    if (anchor) {
      return teams.filter((t) => t.ownerUserId === anchor.ownerUserId);
    }
  }
  const fromUserid = searchParams.get("userid")?.trim();
  if (fromUserid) {
    return teams.filter((t) => t.ownerUserId === fromUserid);
  }
  const uniqueOwners = new Set(teams.map((t) => t.ownerUserId));
  if (uniqueOwners.size <= 1) {
    return teams;
  }
  return teams.filter((t) => t.ownerUserId === userId);
}

function TeamAdminHeaderSwitcherInner({
  teams,
  userId,
}: {
  teams: TeamAdminHeaderSwitcherTeam[];
  userId: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const displayedTeams = useMemo(
    () => teamAdminWorkspaceTeamsForUrl(teams, userId, searchParams),
    [teams, userId, searchParams],
  );

  const selectedId = useMemo(() => {
    const rawTeam = searchParams.get("team");
    const teamIdFromUrl = rawTeam ? Number(rawTeam) : NaN;
    if (displayedTeams.length === 0) {
      return Number.NaN;
    }
    return displayedTeams.some((t) => t.id === teamIdFromUrl)
      ? teamIdFromUrl
      : displayedTeams[0]!.id;
  }, [searchParams, displayedTeams]);

  if (pathname !== "/dashboard/team-admin") return null;
  if (displayedTeams.length === 0) return null;

  return (
    <>
      <p id="team-admin-header-team-switcher-hint" className="sr-only">
        Choose which team this page is for—members, invites, and deck access update when you
        switch.
      </p>
      <TeamSwitcherDropdown
        teams={displayedTeams.map((t) => ({
          id: t.id,
          name: t.name,
          ownerUserId: t.ownerUserId,
          workspacePlanQuery: t.workspacePlanQuery,
        }))}
        selectedId={selectedId}
        ariaDescribedBy="team-admin-header-team-switcher-hint"
        showManageWorkspaces={displayedTeams.some((t) => t.ownerUserId === userId)}
      />
    </>
  );
}

/** Uses client pathname/search so the switcher is not tied to optional `x-pathname` proxy headers (full refresh). */
export function TeamAdminHeaderSwitcherClient({
  teams,
  userId,
}: {
  teams: TeamAdminHeaderSwitcherTeam[];
  userId: string;
}) {
  if (teams.length === 0) return null;
  return (
    <Suspense fallback={null}>
      <TeamAdminHeaderSwitcherInner teams={teams} userId={userId} />
    </Suspense>
  );
}
