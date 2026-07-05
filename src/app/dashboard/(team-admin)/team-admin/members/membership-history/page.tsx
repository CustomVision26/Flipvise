import TeamAdminDashboardView from "../../team-admin-dashboard-view";
import { buildTeamAdminMembersHistoryPath } from "@/lib/team-admin-url";

export default async function TeamAdminMembersHistoryPage({
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
      buildCanonicalPath={buildTeamAdminMembersHistoryPath}
    />
  );
}
