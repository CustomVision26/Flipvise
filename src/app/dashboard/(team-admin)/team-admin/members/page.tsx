import TeamAdminDashboardView from "../team-admin-dashboard-view";
import { buildTeamAdminMembersPath } from "@/lib/team-admin-url";

export default async function TeamAdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
    userid?: string;
    plan?: string;
  }>;
}) {
  return (
    <TeamAdminDashboardView
      searchParams={searchParams}
      buildCanonicalPath={buildTeamAdminMembersPath}
    />
  );
}
