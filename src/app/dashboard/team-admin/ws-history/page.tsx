import TeamAdminDashboardView from "../team-admin-dashboard-view";
import { buildTeamAdminWsHistoryPath } from "@/lib/team-admin-url";

export default async function TeamAdminWorkspaceHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; userid?: string; plan?: string }>;
}) {
  return (
    <TeamAdminDashboardView
      searchParams={searchParams}
      buildCanonicalPath={buildTeamAdminWsHistoryPath}
    />
  );
}
