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
  const learnerIds = [
    ...new Set(stats.members.map((member) => member.userId)),
  ];
  const displays =
    learnerIds.length > 0
      ? await getClerkUserFieldDisplaysByIds(learnerIds)
      : {};

  const labelFor = (userId: string) =>
    displays[userId]?.primaryLine ?? userId;

  const statsWithNames = {
    ...stats,
    members: stats.members.map((member) => ({
      ...member,
      memberLabel: labelFor(member.userId),
    })),
    sessions: stats.sessions.map((session) => ({
      ...session,
      memberLabel: labelFor(session.userId),
    })),
    topLearners: stats.topLearners.map((learner) => ({
      ...learner,
      memberLabel: labelFor(learner.userId),
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
