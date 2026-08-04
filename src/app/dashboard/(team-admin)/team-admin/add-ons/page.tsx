import {
  TEAM_ADMIN_ADDONS_PATH,
  buildTeamAdminAddonsPath,
} from "@/lib/team-admin-url";
import { loadTeamAdminPageContext } from "@/lib/load-team-admin-page-context";
import { TeamAdminToolPageLayout } from "@/components/team-admin-tool-page-layout";
import { TeamAdminAddonsPanel } from "@/components/team-admin-addons-panel";

interface PageProps {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
    userid?: string;
    plan?: string;
  }>;
}

export default async function TeamAdminAddonsPage({ searchParams }: PageProps) {
  const ctx = await loadTeamAdminPageContext(buildTeamAdminAddonsPath, searchParams);

  return (
    <TeamAdminToolPageLayout
      pathname={TEAM_ADMIN_ADDONS_PATH}
      ctx={ctx}
      legacyHeader={null}
    >
      <TeamAdminAddonsPanel />
    </TeamAdminToolPageLayout>
  );
}
