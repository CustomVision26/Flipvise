import Link from "next/link";
import { ArrowLeft, CalendarClock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDecksForTeamWithCardCount } from "@/db/queries/teams";
import {
  listQuizScheduleDeckSnapshots,
  listQuizScheduleWorkspaceSnapshots,
} from "@/db/queries/quiz-schedule";
import {
  TEAM_ADMIN_QUIZ_SCHEDULE_PATH,
  buildTeamAdminPath,
  buildTeamAdminQuizResultsPath,
  buildTeamAdminQuizSchedulePath,
  buildTeamAdminQuizSecurityPath,
  buildTeamAdminQuizTimerPath,
} from "@/lib/team-admin-url";
import { loadTeamAdminPageContext } from "@/lib/load-team-admin-page-context";
import {
  TeamAdminPanelScroll,
  TeamAdminQuickNavPanel,
  TeamAdminWorkspaceStatsPanel,
  TeamQuizResultsSubTabs,
  TeamQuizScheduleSettings,
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

export default async function TeamAdminQuizSchedulePage({ searchParams }: PageProps) {
  const ctx = await loadTeamAdminPageContext(buildTeamAdminQuizSchedulePath, searchParams);
  const { selected, teamsForSubscriber, viewerTeamMemberUrlParam, isOwner } = ctx;

  const [workspaceSnapshots, teamDecksWithCardCounts, decksByWorkspaceEntries] =
    await Promise.all([
      listQuizScheduleWorkspaceSnapshots(teamsForSubscriber),
      getDecksForTeamWithCardCount(selected.id, selected.ownerUserId),
      Promise.all(
        teamsForSubscriber.map(async (team) => [
          team.id,
          await listQuizScheduleDeckSnapshots(team.id, team.ownerUserId),
        ] as const),
      ),
    ]);

  const decksByWorkspaceId = Object.fromEntries(decksByWorkspaceEntries);

  const quickNavDescription = isOwner
    ? "Return to your personal dashboard to create and edit decks."
    : "Open your personal dashboard or the workspace-scoped main dashboard.";

  return (
    <TeamAdminToolPageLayout
      pathname={TEAM_ADMIN_QUIZ_SCHEDULE_PATH}
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
                <span className="text-muted-foreground/80">Quiz results</span>
              </div>
              <div className="space-y-2">
                <h1
                  id={TEAM_ADMIN_PANEL_IDS.quizResults}
                  className={cn(
                    "text-2xl font-semibold tracking-tight sm:text-3xl",
                    teamAdminPanelScrollClass,
                  )}
                >
                  Quiz schedule
                </h1>
                <p className="truncate text-sm text-muted-foreground" title={selected.name}>
                  {selected.name}
                </p>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Choose when members can start a quiz. Set a workspace-wide start time or override it
                per deck.
              </p>
            </div>
            <TeamAdminQuickNavPanel
              className="w-full shrink-0 sm:max-w-sm"
              planLabel={ctx.planLabel}
              description={quickNavDescription}
              mainDashboardHref={ctx.mainDashboardHref}
              workspaceDashboardHref={ctx.workspaceDashboardHref}
              workspaceTeamId={selected.id}
              workspaceTeamMemberUrlParam={viewerTeamMemberUrlParam}
              isOwner={isOwner}
              workspacePlanSlug={selected.planSlug}
              showTeacherDashboard={ctx.showTeacherDashboard}
            />
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
              <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              Quiz start times
            </span>
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Toggle scheduling on or off for each workspace and deck. Members see a countdown until
            the quiz unlocks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workspaceSnapshots.length > 0 ? (
            <TeamQuizScheduleSettings
              workspaces={toClientJson(workspaceSnapshots)}
              decksByWorkspaceId={toClientJson(decksByWorkspaceId)}
              defaultWorkspaceId={selected.id}
            />
          ) : null}
        </CardContent>
      </Card>
    </TeamAdminToolPageLayout>
  );
}
