import { TeamAdminToolPageLayout } from "@/components/team-admin-tool-page-layout";
import { AiRecallSessionCardsSettingsLoader } from "@/components/ai-recall-session-cards-settings-loader";
import { clampAiRecallSessionCardCount } from "@/lib/ai-recall-session-cards";
import { listAiRecallSessionCardDeckSnapshots } from "@/db/queries/teams";
import { loadTeamAdminPageContext } from "@/lib/load-team-admin-page-context";
import {
  TEAM_ADMIN_ACTIVE_RECALL_SESSION_CARDS_PATH,
  buildTeamAdminActiveRecallSessionCardsPath,
} from "@/lib/team-admin-url";

interface PageProps {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
    userid?: string;
    plan?: string;
  }>;
}

export default async function TeamAdminActiveRecallSessionCardsPage({
  searchParams,
}: PageProps) {
  const ctx = await loadTeamAdminPageContext(
    buildTeamAdminActiveRecallSessionCardsPath,
    searchParams,
  );
  const { selected } = ctx;
  const initialWorkspaceCardCount = clampAiRecallSessionCardCount(
    selected.aiRecallSessionCardCount ?? null,
  );
  const decks = await listAiRecallSessionCardDeckSnapshots(
    selected.id,
    selected.ownerUserId,
  );

  return (
    <TeamAdminToolPageLayout
      pathname={TEAM_ADMIN_ACTIVE_RECALL_SESSION_CARDS_PATH}
      ctx={ctx}
      legacyHeader={null}
    >
      <AiRecallSessionCardsSettingsLoader
        teamId={selected.id}
        initialWorkspaceCardCount={initialWorkspaceCardCount}
        decks={decks}
      />
    </TeamAdminToolPageLayout>
  );
}
