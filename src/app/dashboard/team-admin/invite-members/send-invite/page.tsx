import TeamAdminDashboardView from "../../team-admin-dashboard-view";
import { buildTeamAdminInviteSendPath } from "@/lib/team-admin-url";

export default async function TeamAdminInviteSendPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; userid?: string; plan?: string }>;
}) {
  return (
    <TeamAdminDashboardView
      searchParams={searchParams}
      buildCanonicalPath={buildTeamAdminInviteSendPath}
    />
  );
}
