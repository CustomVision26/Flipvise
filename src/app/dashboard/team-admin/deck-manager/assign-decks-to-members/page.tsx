import Link from "next/link";
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
import { TeamAdminDashboardNavActions } from "@/components/team-admin-dashboard-nav-actions";
import { TeamAdminWorkspaceDeckCardTotals } from "@/components/team-admin-workspace-deck-card-totals";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";
import { getAccessContext } from "@/lib/access";
import { personalDashboardPlanQueryValue } from "@/lib/team-plans";

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

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-muted-foreground text-sm">
            <Link
              href={buildTeamAdminPath(selected.id, viewerTeamMemberUrlParam)}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              Team Admin
            </Link>
            <span aria-hidden className="px-1.5">
              /
            </span>
            <span className="text-foreground">Deck Manager</span>
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Assign decks to members</h1>
          <p
            className="text-muted-foreground text-sm font-medium sm:text-base truncate min-w-0"
            title={selected.name}
          >
            Workspace: {selected.name}
          </p>
          <p className="text-muted-foreground text-sm sm:text-base">
            Subscribers manage flashcards from the Personal Dashboard, then attach decks here to
            their workspace before assigning team members or team admins — subscribers also see every
            linked deck without an assignment row.
          </p>
        </div>
        <TeamAdminDashboardNavActions
          mainDashboardHref={mainDashboardHref}
          workspaceDashboardHref={workspaceDashboardHref}
          workspaceTeamId={selected.id}
          isOwner={isOwner}
          workspacePlanSlug={selected.planSlug}
          className="self-start"
        />
      </div>

      <TeamAdminWorkspaceDeckCardTotals
        teamDecksWithCardCounts={teamDecksWithCardCounts}
        planSlug={selected.planSlug}
      />

      <Card>
        <CardHeader>
          <CardTitle>Deck Manager</CardTitle>
          <CardDescription>
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
