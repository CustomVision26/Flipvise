import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getDecksForTeamWithCardCount,
  getOwnerQuizDefaultSettings,
  getTeamsByOwner,
  listQuizTimerDeckSnapshots,
  listQuizTimerWorkspaceSnapshots,
} from "@/db/queries/teams";
import {
  TEAM_ADMIN_QUIZ_TIMER_PATH,
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
  TeamQuizTimerSettings,
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

export default async function TeamAdminQuizTimerPage({ searchParams }: PageProps) {
  const ctx = await loadTeamAdminPageContext(buildTeamAdminQuizTimerPath, searchParams);
  const { selected, teamsForSubscriber, viewerTeamMemberUrlParam, isOwner } = ctx;

  const [
    workspaceSnapshots,
    ownerQuizSettings,
    teamDecksWithCardCounts,
    ownedWorkspaceCount,
    decksByWorkspaceEntries,
  ] = await Promise.all([
    listQuizTimerWorkspaceSnapshots(teamsForSubscriber),
    getOwnerQuizDefaultSettings(selected.ownerUserId),
    getDecksForTeamWithCardCount(selected.id, selected.ownerUserId),
    isOwner ? getTeamsByOwner(ctx.userId).then((rows) => rows.length) : Promise.resolve(0),
    Promise.all(
      teamsForSubscriber.map(
        async (team) =>
          [team.id, await listQuizTimerDeckSnapshots(team.id, team.ownerUserId)] as const,
      ),
    ),
  ]);

  const decksByWorkspaceId = Object.fromEntries(decksByWorkspaceEntries);

  const selectedWorkspaceSnapshot =
    workspaceSnapshots.find((w) => w.id === selected.id) ?? workspaceSnapshots[0] ?? null;

  const quickNavDescription = isOwner
    ? "Return to your personal dashboard to create and edit decks."
    : "Open your personal dashboard or the workspace-scoped main dashboard.";

  return (
    <TeamAdminToolPageLayout
      pathname={TEAM_ADMIN_QUIZ_TIMER_PATH}
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
                  Quiz timer
                </h1>
                <p className="truncate text-sm text-muted-foreground" title={selected.name}>
                  {selected.name}
                </p>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {isOwner
                  ? "Set a general quiz time for linked decks, or choose a timed-quiz length for each deck in a workspace."
                  : "Set a timed-quiz length for each deck in workspaces you manage when the subscriber allows it."}
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
              <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              Timed quiz duration
            </span>
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            {selectedWorkspaceSnapshot ? (
              <>
                Active quiz time for{" "}
                <span className="font-medium text-foreground">{selected.name}</span>:{" "}
                <span className="font-medium text-foreground">
                  {selectedWorkspaceSnapshot.effectiveMinutes} minutes
                </span>
                .{" "}
                {workspaceSnapshots.length > 1
                  ? `${workspaceSnapshots.length} workspaces available below.`
                  : null}
              </>
            ) : (
              "No workspaces available for quiz timer settings."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workspaceSnapshots.length > 0 ? (
            <TeamQuizTimerSettings
              workspaces={toClientJson(workspaceSnapshots)}
              decksByWorkspaceId={toClientJson(decksByWorkspaceId)}
              defaultWorkspaceId={selected.id}
              isSubscriberOwner={isOwner}
              ownedWorkspaceCount={ownedWorkspaceCount}
              globalDefaultMinutes={ownerQuizSettings.defaultQuizDurationMinutes}
              enforceDefaultForAllWorkspaces={
                ownerQuizSettings.enforceDefaultForAllWorkspaces
              }
            />
          ) : null}
        </CardContent>
      </Card>
    </TeamAdminToolPageLayout>
  );
}
