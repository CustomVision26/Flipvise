import TeamAdminDashboardView from "../../team-admin-dashboard-view";
import { buildTeamAdminInviteHistoryPath } from "@/lib/team-admin-url";

export default async function TeamAdminInvitationHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; userid?: string; plan?: string }>;
}) {
  return (
    <TeamAdminDashboardView
      searchParams={searchParams}
      buildCanonicalPath={buildTeamAdminInviteHistoryPath}
    />
  );
}
