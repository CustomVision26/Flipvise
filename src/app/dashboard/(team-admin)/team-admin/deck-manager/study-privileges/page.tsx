import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getDecksForTeam,
  getDecksForTeamWithCardCount,
  listAssignmentsForTeam,
  listTeamMembers,
} from "@/db/queries/teams";
import {
  TEAM_ADMIN_STUDY_PRIVILEGES_PATH,
  buildTeamAdminAssignDecksToMembersPath,
  buildTeamAdminPath,
  buildTeamAdminStudyPrivilegesPath,
} from "@/lib/team-admin-url";
import { loadTeamAdminPageContext } from "@/lib/load-team-admin-page-context";
import { toClientJson } from "@/lib/to-client-json";
import {
  TeamAdminPanelScroll,
  TeamAdminQuickNavPanel,
  TeamAdminWorkspaceStatsPanel,
  TeamDeckManagerSubTabs,
  TeamQuizFormatsSettings,
  TeamStudyPrivilegesTable,
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
import {
  listQuizFormatsDecksForWorkspace,
  listQuizFormatsWorkspacesForOwner,
} from "@/db/queries/quiz-formats";

interface PageProps {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
    userid?: string;
    plan?: string;
  }>;
}

export default async function TeamAdminStudyPrivilegesPage({ searchParams }: PageProps) {
  const ctx = await loadTeamAdminPageContext(buildTeamAdminStudyPrivilegesPath, searchParams);
  const { userId, selected, teamsForSubscriber, viewerTeamMemberUrlParam, isOwner } = ctx;

  const [privilegeWorkspaceSnapshots, teamDecksWithCardCounts, quizFormatWorkspaces] =
    await Promise.all([
    Promise.all(
      teamsForSubscriber.map(async (t) => {
        const [teamMembers, decks, assignments] = await Promise.all([
          listTeamMembers(t.id),
          getDecksForTeam(t.id, t.ownerUserId),
          listAssignmentsForTeam(t.id),
        ]);
        return {
          id: t.id,
          name: t.name,
          teamMembers,
          decks,
          assignments,
        };
      }),
    ),
    getDecksForTeamWithCardCount(selected.id, selected.ownerUserId),
    listQuizFormatsWorkspacesForOwner(userId),
  ]);

  const subscriberTeamIds = new Set(teamsForSubscriber.map((t) => t.id));
  const quizFormatsWorkspacesForUi = quizFormatWorkspaces.filter((w) =>
    subscriberTeamIds.has(w.id),
  );
  const decksByWorkspaceId: Record<
    number,
    Awaited<ReturnType<typeof listQuizFormatsDecksForWorkspace>>
  > = {};
  await Promise.all(
    teamsForSubscriber.map(async (t) => {
      decksByWorkspaceId[t.id] = await listQuizFormatsDecksForWorkspace(
        t.id,
        t.ownerUserId,
      );
    }),
  );

  const memberUserIds = privilegeWorkspaceSnapshots.flatMap((w) =>
    w.teamMembers.map((m) => m.userId),
  );
  const userFieldDisplayById = await getClerkUserFieldDisplaysByIds([
    ...new Set(memberUserIds),
  ]);

  const quickNavDescription = isOwner
    ? "Return to your personal dashboard to create and edit decks."
    : "Open your personal dashboard or the workspace-scoped main dashboard.";

  return (
    <TeamAdminToolPageLayout
      pathname={TEAM_ADMIN_STUDY_PRIVILEGES_PATH}
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
                <span className="text-muted-foreground/80">Deck manager</span>
              </div>
              <div className="space-y-2">
                <h1
                  id={TEAM_ADMIN_PANEL_IDS.deckManager}
                  className={cn(
                    "text-2xl font-semibold tracking-tight sm:text-3xl",
                    teamAdminPanelScrollClass,
                  )}
                >
                  Study privileges
                </h1>
                <p className="truncate text-sm text-muted-foreground" title={selected.name}>
                  {selected.name}
                </p>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Control which study modes regular members may use for each assigned deck.
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

          <TeamDeckManagerSubTabs
            assignDecksHref={buildTeamAdminAssignDecksToMembersPath(
              selected.id,
              viewerTeamMemberUrlParam,
            )}
            studyPrivilegesHref={buildTeamAdminStudyPrivilegesPath(
              selected.id,
              viewerTeamMemberUrlParam,
            )}
          />
        </>
      }
    >
      <TeamQuizFormatsSettings
        workspaces={toClientJson(quizFormatsWorkspacesForUi)}
        decksByWorkspaceId={toClientJson(decksByWorkspaceId)}
        defaultWorkspaceId={selected.id}
      />

      <Card className={teamAdminActivePanelClass}>
        <CardHeader className="space-y-2 pb-4">
          <CardTitle className={cn(teamAdminActivePanelTitleClass, teamAdminPanelScrollClass)}>
            Member study modes
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Each row is a deck assignment for a regular team member. Update or remove study features
            as needed — changes apply on their next study session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamStudyPrivilegesTable
            workspaces={toClientJson(privilegeWorkspaceSnapshots)}
            defaultWorkspaceId={selected.id}
            userFieldDisplayById={toClientJson(userFieldDisplayById)}
          />
        </CardContent>
      </Card>
    </TeamAdminToolPageLayout>
  );
}
