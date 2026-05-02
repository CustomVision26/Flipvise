import TeamAdminDashboardView from "../team-admin-dashboard-view";
import { buildTeamAdminQuizResultsPath } from "@/lib/team-admin-url";

export default async function TeamAdminQuizResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; userid?: string; plan?: string }>;
}) {
  return (
    <TeamAdminDashboardView
      searchParams={searchParams}
      buildCanonicalPath={buildTeamAdminQuizResultsPath}
    />
  );
}
