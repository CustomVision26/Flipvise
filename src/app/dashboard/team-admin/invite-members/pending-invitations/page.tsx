import TeamAdminDashboardView from "../../team-admin-dashboard-view";
import { buildTeamAdminInvitePendingPath } from "@/lib/team-admin-url";

export default async function TeamAdminInvitePendingPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; userid?: string; plan?: string }>;
}) {
  return (
    <TeamAdminDashboardView
      searchParams={searchParams}
      buildCanonicalPath={buildTeamAdminInvitePendingPath}
    />
  );
}
