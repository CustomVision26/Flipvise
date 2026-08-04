import { AiRecallTeamStatsPanel } from "@/components/ai-recall-team-stats-panel";
import { TeamAdminToolPageLayout } from "@/components/team-admin-tool-page-layout";
import { getTeamAiRecallStats } from "@/db/queries/ai-recall";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";
import { loadTeamAdminPageContext } from "@/lib/load-team-admin-page-context";
import {
  TEAM_ADMIN_ACTIVE_RECALL_PATH,
  buildTeamAdminActiveRecallPath,
} from "@/lib/team-admin-url";

interface PageProps {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
    userid?: string;
    plan?: string;
  }>;
}

export default async function TeamAdminActiveRecallPage({
  searchParams,
}: PageProps) {
  const ctx = await loadTeamAdminPageContext(
    buildTeamAdminActiveRecallPath,
    searchParams,
  );
  const { selected } = ctx;

  const stats = await getTeamAiRecallStats(selected.id);
  const learnerIds = stats.topLearners.map((l) => l.userId);
  const displays =
    learnerIds.length > 0
      ? await getClerkUserFieldDisplaysByIds(learnerIds)
      : {};

  const statsWithNames = {
    ...stats,
    topLearners: stats.topLearners.map((l) => ({
      ...l,
      userId: displays[l.userId]?.primaryLine ?? l.userId,
    })),
  };

  return (
    <TeamAdminToolPageLayout
      pathname={TEAM_ADMIN_ACTIVE_RECALL_PATH}
      ctx={ctx}
      legacyHeader={null}
    >
      <AiRecallTeamStatsPanel
        stats={statsWithNames}
        workspaceName={selected.name}
      />
    </TeamAdminToolPageLayout>
  );
}
