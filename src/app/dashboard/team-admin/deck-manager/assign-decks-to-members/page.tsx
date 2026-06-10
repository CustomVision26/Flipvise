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
  roleReceivesDeckAssignments,
} from "@/db/queries/teams";
import { getOwnedDecksByUserWithCardCount } from "@/db/queries/decks";
import {
  buildTeamAdminAssignDecksToMembersPath,
  buildTeamAdminPath,
} from "@/lib/team-admin-url";
import { resolveTeamAdminDashboardSelection } from "@/lib/resolve-team-admin-dashboard-selection";
import { TeamDeckAssignListLoader } from "@/components/team-deck-assign-list-loader";
import { toClientJson } from "@/lib/to-client-json";
import { TeamAdminQuickNavPanel } from "@/components/team-admin-quick-nav-panel";
import { TeamAdminWorkspaceStatsPanel } from "@/components/team-admin-workspace-stats-panel";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";
import { getAccessContext } from "@/lib/access";
import { labelForTeamPlanSlug, personalDashboardPlanQueryValue } from "@/lib/team-plans";

interface PageProps {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
    userid?: string;
    plan?: string;
  }>;
}

export default async function TeamAdminAssignDecksToMembersPage({ searchParams }: PageProps) {
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
    buildCanonicalPath: buildTeamAdminAssignDecksToMembersPath,
  });
  if (resolution.outcome === "redirect") {
    redirect(resolution.to);
  }
  const { selected, teamsForSubscriber, viewerTeamMemberUrlParam } = resolution;

  const [assignWorkspaceSnapshots, teamDecksWithCardCounts] = await Promise.all([
    Promise.all(
      teamsForSubscriber.map(async (t) => {
        const [allMembers, decks, assignments] = await Promise.all([
          listTeamMembers(t.id),
          getDecksForTeam(t.id, t.ownerUserId),
          listAssignmentsForTeam(t.id),
        ]);
        return {
          id: t.id,
          name: t.name,
          ownerUserId: t.ownerUserId,
          normalMembers: allMembers.filter((m) => roleReceivesDeckAssignments(m.role)),
          allMembers,
          decks,
          assignments,
        };
      }),
    ),
    getDecksForTeamWithCardCount(selected.id, selected.ownerUserId),
  ]);

  const assignMemberUserIds = assignWorkspaceSnapshots.flatMap((w) =>
    w.allMembers.map((m) => m.userId),
  );
  const assignmentSignerUserIds = assignWorkspaceSnapshots.flatMap((w) =>
    w.assignments
      .map((a) => a.assignedByUserId)
      .filter((id): id is string => Boolean(id)),
  );
  const workspaceOwnerUserIds = assignWorkspaceSnapshots.map((w) => w.ownerUserId);
  const userFieldDisplayById = await getClerkUserFieldDisplaysByIds([
    ...new Set([...assignMemberUserIds, ...assignmentSignerUserIds, ...workspaceOwnerUserIds]),
  ]);

  const selectedWsDecks =
    assignWorkspaceSnapshots.find((w) => w.id === selected.id)?.decks ?? [];
  const decksListedForWorkspace = new Set(selectedWsDecks.map((d) => d.id));
  const subscriberPersonalUnlinkedDecks =
    selected.ownerUserId === userId
      ? (await getOwnedDecksByUserWithCardCount(selected.ownerUserId)).map((d) => ({
          id: d.id,
          name: d.name,
          alreadyLinked: decksListedForWorkspace.has(d.id),
        }))
      : undefined;

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
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="inline-flex w-fit flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <Link
              href={buildTeamAdminPath(selected.id, viewerTeamMemberUrlParam)}
              className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
              Team admin
            </Link>
            <span aria-hidden>·</span>
            <span className="text-muted-foreground/80">Deck manager</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Assign decks to members
            </h1>
            <p className="truncate text-sm text-muted-foreground" title={selected.name}>
              {selected.name}
            </p>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Link personal decks to this workspace, then assign them to members or co-admins.
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

      <Card className="border-border/80 bg-card/60 shadow-sm">
        <CardHeader className="space-y-2 pb-4">
          <CardTitle className="text-base font-medium tracking-tight sm:text-lg">
            Deck assignments
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Link decks from Personal and assign workspace decks to members or co-admins.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamDeckAssignListLoader
            workspaces={toClientJson(assignWorkspaceSnapshots)}
            defaultWorkspaceId={selected.id}
            userFieldDisplayById={toClientJson(userFieldDisplayById)}
            subscriberPersonalUnlinkedDecks={
              subscriberPersonalUnlinkedDecks
                ? toClientJson(subscriberPersonalUnlinkedDecks)
                : undefined
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
