import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { cookies } from "next/headers";
import { auth } from "@/lib/clerk-auth";
import { redirect } from "next/navigation";
import { TEAM_CONTEXT_COOKIE } from "@/lib/team-context-cookie";
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
  getTeamsForTeamDashboard,
  listQuizTimerWorkspaceSnapshots,
} from "@/db/queries/teams";
import {
  buildTeamAdminPath,
  buildTeamAdminQuizResultsPath,
  buildTeamAdminQuizTimerPath,
} from "@/lib/team-admin-url";
import { resolveTeamAdminDashboardSelection } from "@/lib/resolve-team-admin-dashboard-selection";
import { TeamAdminQuickNavPanel } from "@/components/team-admin-quick-nav-panel";
import { TeamAdminPanelScroll } from "@/components/team-admin-panel-scroll";
import {
  TEAM_ADMIN_PANEL_IDS,
  teamAdminActivePanelClass,
  teamAdminActivePanelTitleClass,
  teamAdminPanelScrollClass,
} from "@/components/team-admin-panel-styles";
import { cn } from "@/lib/utils";
import { TeamAdminWorkspaceStatsPanel } from "@/components/team-admin-workspace-stats-panel";
import { getAccessContext } from "@/lib/access";
import { labelForTeamPlanSlug, personalDashboardPlanQueryValue } from "@/lib/team-plans";
import { TeamQuizResultsSubTabs } from "@/components/team-quiz-results-sub-tabs";
import { TeamQuizTimerSettings } from "@/components/team-quiz-timer-settings";
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
  const { userId } = await auth();
  if (!userId) redirect("/");

  const teams = await getTeamsForTeamDashboard(userId);
  if (teams.length === 0) {
    redirect("/onboarding/team");
  }

  const sp = await searchParams;
  const teamMemberIdParam =
    typeof sp.teamMemberId === "string" ? sp.teamMemberId : undefined;
  const useridParam = typeof sp.userid === "string" ? sp.userid : undefined;
  const planParam =
    typeof sp.plan === "string" && sp.plan.trim() !== "" ? sp.plan.trim() : undefined;

  const cookieStore = await cookies();
  const cookieRaw = cookieStore.get(TEAM_CONTEXT_COOKIE)?.value;

  const resolution = await resolveTeamAdminDashboardSelection(teams, {
    viewerUserId: userId,
    teamParam: sp.team,
    teamMemberIdParam,
    cookieTeamRaw: cookieRaw,
    useridParam,
    planParam,
    buildCanonicalPath: buildTeamAdminQuizTimerPath,
  });
  if (resolution.outcome === "redirect") {
    redirect(resolution.to);
  }
  const { selected, teamsForSubscriber, viewerTeamMemberUrlParam } = resolution;

  const isOwner = selected.ownerUserId === userId;

  const [workspaceSnapshots, ownerQuizSettings, teamDecksWithCardCounts, ownedWorkspaceCount] =
    await Promise.all([
      listQuizTimerWorkspaceSnapshots(teamsForSubscriber),
      getOwnerQuizDefaultSettings(selected.ownerUserId),
      getDecksForTeamWithCardCount(selected.id, selected.ownerUserId),
      isOwner ? getTeamsByOwner(userId).then((rows) => rows.length) : Promise.resolve(0),
    ]);

  const selectedWorkspaceSnapshot =
    workspaceSnapshots.find((w) => w.id === selected.id) ?? workspaceSnapshots[0] ?? null;

  const access = await getAccessContext();
  const personalStripeSlug = access.hasClerkPersonalProPlus
    ? ("pro_plus" as const)
    : access.hasClerkPersonalPro
      ? ("pro" as const)
      : null;
  const personalPlanQuery = personalDashboardPlanQueryValue(
    access.activeTeamPlan,
    access.isPro,
    personalStripeSlug,
  );
  const personalDashboardParams = new URLSearchParams({ userid: userId });
  if (personalPlanQuery !== "") personalDashboardParams.set("plan", personalPlanQuery);
  const mainDashboardHref = `/dashboard?${personalDashboardParams.toString()}`;
  const workspaceDashboardParams = new URLSearchParams({
    team: String(selected.id),
    userid: selected.ownerUserId,
    plan: selected.planSlug,
    teamMemberId: String(viewerTeamMemberUrlParam),
  });
  const workspaceDashboardHref = `/dashboard?${workspaceDashboardParams.toString()}`;
  const planLabel = labelForTeamPlanSlug(selected.planSlug) ?? selected.planSlug;

  return (
    <div className="flex flex-1 flex-col gap-8 p-4 sm:p-8">
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
              ? "Set one quiz time for all workspaces, or allow custom presets per workspace."
              : "View workspace quiz times and set custom presets when the subscriber allows it."}
          </p>
        </div>
        <TeamAdminQuickNavPanel
          className="w-full shrink-0 sm:max-w-sm"
          planLabel={planLabel}
          description={
            isOwner
              ? "Return to your personal dashboard to create and edit decks."
              : "Open your personal dashboard or the workspace-scoped main dashboard."
          }
          mainDashboardHref={mainDashboardHref}
          workspaceDashboardHref={workspaceDashboardHref}
          workspaceTeamId={selected.id}
          isOwner={isOwner}
          workspacePlanSlug={selected.planSlug}
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
      />

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
    </div>
  );
}
