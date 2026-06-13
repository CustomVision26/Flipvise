import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
  getDecksForTeam,
  getDecksForTeamWithCardCount,
  getTeamsForTeamDashboard,
  listAssignmentsForTeam,
  listTeamMembers,
} from "@/db/queries/teams";
import {
  buildTeamAdminAssignDecksToMembersPath,
  buildTeamAdminPath,
  buildTeamAdminStudyPrivilegesPath,
} from "@/lib/team-admin-url";
import { resolveTeamAdminDashboardSelection } from "@/lib/resolve-team-admin-dashboard-selection";
import { toClientJson } from "@/lib/to-client-json";
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
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";
import { getAccessContext } from "@/lib/access";
import { labelForTeamPlanSlug, personalDashboardPlanQueryValue } from "@/lib/team-plans";
import { TeamDeckManagerSubTabs } from "@/components/team-deck-manager-sub-tabs";
import { TeamStudyPrivilegesTable } from "@/components/team-study-privileges-table";

interface PageProps {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
    userid?: string;
    plan?: string;
  }>;
}

export default async function TeamAdminStudyPrivilegesPage({ searchParams }: PageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const teams = await getTeamsForTeamDashboard(userId);
  if (teams.length === 0) {
    redirect("/onboarding/team");
  }

  const sp = await searchParams;
  const teamParam = sp.team;
  const teamMemberIdParam =
    typeof sp.teamMemberId === "string" ? sp.teamMemberId : undefined;
  const useridParam = typeof sp.userid === "string" ? sp.userid : undefined;
  const planParam =
    typeof sp.plan === "string" && sp.plan.trim() !== "" ? sp.plan.trim() : undefined;

  const cookieStore = await cookies();
  const cookieRaw = cookieStore.get(TEAM_CONTEXT_COOKIE)?.value;

  const resolution = await resolveTeamAdminDashboardSelection(teams, {
    viewerUserId: userId,
    teamParam,
    teamMemberIdParam,
    cookieTeamRaw: cookieRaw,
    useridParam,
    planParam,
    buildCanonicalPath: buildTeamAdminStudyPrivilegesPath,
  });
  if (resolution.outcome === "redirect") {
    redirect(resolution.to);
  }
  const { selected, teamsForSubscriber, viewerTeamMemberUrlParam } = resolution;

  const [privilegeWorkspaceSnapshots, teamDecksWithCardCounts] = await Promise.all([
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
  ]);

  const memberUserIds = privilegeWorkspaceSnapshots.flatMap((w) =>
    w.teamMembers.map((m) => m.userId),
  );
  const userFieldDisplayById = await getClerkUserFieldDisplaysByIds([
    ...new Set(memberUserIds),
  ]);

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
  const isOwner = selected.ownerUserId === userId;
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
    </div>
  );
}
