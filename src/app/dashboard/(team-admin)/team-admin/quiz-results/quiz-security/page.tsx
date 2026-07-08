import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getDecksForTeamWithCardCount,
  listTeamMembers,
} from "@/db/queries/teams";
import {
  listQuizSecurityDeckSnapshots,
  listQuizSecuritySessionsForTeamAdmin,
  listQuizSecurityWorkspaceSnapshots,
} from "@/db/queries/quiz-security";
import {
  TEAM_ADMIN_QUIZ_SECURITY_PATH,
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
  TeamQuizSecuritySessionsTable,
  TeamQuizSecuritySettings,
} from "@/lib/team-admin-dynamic-components";
import {
  TEAM_ADMIN_PANEL_IDS,
  teamAdminActivePanelClass,
  teamAdminActivePanelTitleClass,
  teamAdminPanelScrollClass,
} from "@/components/team-admin-panel-styles";
import { TeamAdminToolPageLayout } from "@/components/team-admin-tool-page-layout";
import { cn } from "@/lib/utils";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";
import { toClientJson } from "@/lib/to-client-json";

interface PageProps {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
    userid?: string;
    plan?: string;
  }>;
}

export default async function TeamAdminQuizSecurityPage({ searchParams }: PageProps) {
  const ctx = await loadTeamAdminPageContext(buildTeamAdminQuizSecurityPath, searchParams);
  const { selected, teamsForSubscriber, viewerTeamMemberUrlParam, isOwner } = ctx;

  const [workspaceSnapshots, lockedSessions, teamDecksWithCardCounts, members, decksByWorkspaceEntries] =
    await Promise.all([
      listQuizSecurityWorkspaceSnapshots(teamsForSubscriber),
      listQuizSecuritySessionsForTeamAdmin(selected.id),
      getDecksForTeamWithCardCount(selected.id, selected.ownerUserId),
      listTeamMembers(selected.id),
      Promise.all(
        teamsForSubscriber.map(async (team) => [
          team.id,
          await listQuizSecurityDeckSnapshots(team.id, team.ownerUserId),
        ] as const),
      ),
    ]);

  const decksByWorkspaceId = Object.fromEntries(decksByWorkspaceEntries);

  const sessionUserIds = [
    ...new Set([...lockedSessions.map((s) => s.userId), selected.ownerUserId, ...members.map((m) => m.userId)]),
  ];
  const userFieldDisplayById =
    sessionUserIds.length > 0 ? await getClerkUserFieldDisplaysByIds(sessionUserIds) : {};

  const quickNavDescription = isOwner
    ? "Return to your personal dashboard to create and edit decks."
    : "Open your personal dashboard or the workspace-scoped main dashboard.";

  return (
    <TeamAdminToolPageLayout
      pathname={TEAM_ADMIN_QUIZ_SECURITY_PATH}
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
                  Quiz security
                </h1>
                <p className="truncate text-sm text-muted-foreground" title={selected.name}>
                  {selected.name}
                </p>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Lock members into the quiz UI until they submit. Manage locked sessions and grant
                resume access when needed.
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
              <Shield className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              Workspace security
            </span>
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Turn quiz security on or off per workspace and per deck. Members on a secured quiz
            cannot switch tabs or leave until they submit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workspaceSnapshots.length > 0 ? (
            <TeamQuizSecuritySettings
              workspaces={toClientJson(workspaceSnapshots)}
              decksByWorkspaceId={toClientJson(decksByWorkspaceId)}
              defaultWorkspaceId={selected.id}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card className={teamAdminActivePanelClass}>
        <CardHeader className="space-y-2 pb-4">
          <CardTitle className={cn(teamAdminActivePanelTitleClass, teamAdminPanelScrollClass)}>
            Locked & terminated sessions
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Members who left a quiz, finished and need a redo, or were terminated. Continue to
            let them resume, Start over for a fresh attempt, or terminate an active lock.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamQuizSecuritySessionsTable
            teamId={selected.id}
            sessions={toClientJson(lockedSessions)}
            userFieldDisplayById={userFieldDisplayById}
          />
        </CardContent>
      </Card>
    </TeamAdminToolPageLayout>
  );
}
