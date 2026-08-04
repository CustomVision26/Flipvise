import Link from "next/link";
import { ArrowLeft, ListChecks } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDecksForTeamWithCardCount } from "@/db/queries/teams";
import {
  buildQuizFormatsWorkspaceSnapshots,
  listQuizFormatsDecksForWorkspace,
} from "@/db/queries/quiz-formats";
import {
  TEAM_ADMIN_QUIZ_FORMATS_PATH,
  buildTeamAdminPath,
  buildTeamAdminQuizFormatsPath,
  buildTeamAdminQuizResultsPath,
  buildTeamAdminQuizSchedulePath,
  buildTeamAdminQuizSecurityPath,
  buildTeamAdminQuizTimerPath,
} from "@/lib/team-admin-url";
import { loadTeamAdminPageContext } from "@/lib/load-team-admin-page-context";
import {
  TeamAdminPanelScroll,
  TeamAdminWorkspaceStatsPanel,
  TeamQuizFormatsSettings,
  TeamQuizResultsSubTabs,
} from "@/lib/team-admin-dynamic-components";
import {
  TEAM_ADMIN_PANEL_IDS,
  teamAdminActivePanelClass,
  teamAdminActivePanelTitleClass,
  teamAdminPanelScrollClass,
} from "@/components/team-admin-panel-styles";
import { TeamAdminToolPageLayout } from "@/components/team-admin-tool-page-layout";
import { cn } from "@/lib/utils";
import { toClientJson } from "@/lib/to-client-json";

interface PageProps {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
    userid?: string;
    plan?: string;
  }>;
}

export default async function TeamAdminQuizFormatsPage({ searchParams }: PageProps) {
  const ctx = await loadTeamAdminPageContext(buildTeamAdminQuizFormatsPath, searchParams);
  const { selected, teamsForSubscriber, viewerTeamMemberUrlParam } = ctx;

  const [teamDecksWithCardCounts, quizFormatWorkspaces, decksByWorkspaceEntries] =
    await Promise.all([
      getDecksForTeamWithCardCount(selected.id, selected.ownerUserId),
      Promise.resolve(buildQuizFormatsWorkspaceSnapshots(teamsForSubscriber)),
      Promise.all(
        teamsForSubscriber.map(
          async (team) =>
            [
              team.id,
              await listQuizFormatsDecksForWorkspace(team.id, team.ownerUserId),
            ] as const,
        ),
      ),
    ]);

  const decksByWorkspaceId = Object.fromEntries(decksByWorkspaceEntries);
  const defaultQuizWorkspaceId = quizFormatWorkspaces.some((w) => w.id === selected.id)
    ? selected.id
    : (quizFormatWorkspaces[0]?.id ?? selected.id);

  return (
    <TeamAdminToolPageLayout
      pathname={TEAM_ADMIN_QUIZ_FORMATS_PATH}
      ctx={ctx}
      legacyHeader={
        <>
          <TeamAdminPanelScroll />
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="inline-flex w-fit flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                <Link
                  href={buildTeamAdminPath(selected.id, viewerTeamMemberUrlParam)}
                  className="inline-flex items-center gap-1 font-bold text-primary transition-colors hover:text-primary/85"
                >
                  <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
                  Team admin dash
                </Link>
                <span aria-hidden>·</span>
                <span className="text-muted-foreground/80">Quiz Mode</span>
              </div>
              <div className="space-y-2">
                <h1
                  id={TEAM_ADMIN_PANEL_IDS.quizResults}
                  className={cn(
                    "text-2xl font-semibold tracking-tight sm:text-3xl",
                    teamAdminPanelScrollClass,
                  )}
                >
                  Quiz formats
                </h1>
                <p className="truncate text-sm text-muted-foreground" title={selected.name}>
                  {selected.name}
                </p>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Set workspace defaults and per-deck overrides for quiz question types, then publish
                the mix members see in Timed quiz.
              </p>
            </div>
          </div>

          <TeamAdminWorkspaceStatsPanel
            teamDecksWithCardCounts={teamDecksWithCardCounts}
            planSlug={selected.planSlug}
            showWorkspacesAndMembers={false}
          />

          <TeamQuizResultsSubTabs
            quizResultsHref={buildTeamAdminQuizResultsPath(
              selected.id,
              viewerTeamMemberUrlParam,
            )}
            quizFormatsHref={buildTeamAdminQuizFormatsPath(
              selected.id,
              viewerTeamMemberUrlParam,
            )}
            quizTimerHref={buildTeamAdminQuizTimerPath(
              selected.id,
              viewerTeamMemberUrlParam,
            )}
            quizScheduleHref={buildTeamAdminQuizSchedulePath(
              selected.id,
              viewerTeamMemberUrlParam,
            )}
            quizSecurityHref={buildTeamAdminQuizSecurityPath(
              selected.id,
              viewerTeamMemberUrlParam,
            )}
          />
        </>
      }
    >
      <Card className={teamAdminActivePanelClass}>
        <CardHeader className="space-y-2 pb-4">
          <CardTitle className={cn(teamAdminActivePanelTitleClass, teamAdminPanelScrollClass)}>
            <span className="inline-flex items-center gap-2">
              <ListChecks className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              Quiz question formats
            </span>
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Enable multiple choice, true/false, and fill-in-the-blank for the workspace or
            individual decks. Set questions per format, generate AI sentences when needed, then
            publish all cards or choose a specific subset.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {quizFormatWorkspaces.length > 0 ? (
            <TeamQuizFormatsSettings
              embedded
              workspaces={toClientJson(quizFormatWorkspaces)}
              decksByWorkspaceId={toClientJson(decksByWorkspaceId)}
              defaultWorkspaceId={defaultQuizWorkspaceId}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No workspaces available for quiz format settings.
            </p>
          )}
        </CardContent>
      </Card>
    </TeamAdminToolPageLayout>
  );
}
