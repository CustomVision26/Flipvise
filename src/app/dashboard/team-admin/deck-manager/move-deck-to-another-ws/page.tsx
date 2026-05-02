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
  getTeamsForTeamDashboard,
  listAssignmentsForTeam,
  listTeamMembers,
} from "@/db/queries/teams";
import { isTeamPlanId } from "@/lib/team-plans";
import {
  buildTeamAdminAssignDecksToMembersPath,
  buildTeamAdminMoveDeckToAnotherWsPath,
  buildTeamAdminPath,
} from "@/lib/team-admin-url";
import { buildTeamWorkspaceDashboardPath } from "@/lib/team-workspace-url";
import { resolveTeamAdminDashboardSelection } from "@/lib/resolve-team-admin-dashboard-selection";
import { TeamDeckAssignList } from "@/components/team-deck-assign-list";
import { MainDashboardButton } from "@/components/main-dashboard-button";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";

interface PageProps {
  searchParams: Promise<{ team?: string; userid?: string; plan?: string }>;
}

export default async function TeamAdminMoveDeckToAnotherWsPage({ searchParams }: PageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const teams = await getTeamsForTeamDashboard(userId);
  if (teams.length === 0) {
    redirect("/onboarding/team");
  }

  const sp = await searchParams;
  const teamParam = sp.team;
  const useridParam = typeof sp.userid === "string" ? sp.userid : undefined;
  const planParam =
    typeof sp.plan === "string" && sp.plan.trim() !== "" ? sp.plan.trim() : undefined;

  const cookieStore = await cookies();
  const cookieRaw = cookieStore.get(TEAM_CONTEXT_COOKIE)?.value;

  const resolution = resolveTeamAdminDashboardSelection(teams, {
    teamParam,
    cookieTeamRaw: cookieRaw,
    useridParam,
    planParam,
    buildCanonicalPath: buildTeamAdminMoveDeckToAnotherWsPath,
  });
  if (resolution.outcome === "redirect") {
    redirect(resolution.to);
  }
  const { selected, teamsForSubscriber } = resolution;

  const assignWorkspaceSnapshots = await Promise.all(
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
        normalMembers: allMembers.filter((m) => m.role === "team_member"),
        allMembers,
        decks,
        assignments,
      };
    }),
  );

  const assignMemberUserIds = assignWorkspaceSnapshots.flatMap((w) =>
    w.allMembers.map((m) => m.userId),
  );
  const userFieldDisplayById = await getClerkUserFieldDisplaysByIds([
    ...new Set(assignMemberUserIds),
  ]);

  const mainDashboardHref = isTeamPlanId(selected.planSlug)
    ? buildTeamWorkspaceDashboardPath({ teamId: selected.id })
    : "/dashboard";

  const assignHref = buildTeamAdminAssignDecksToMembersPath(selected.id);
  const moveHref = buildTeamAdminMoveDeckToAnotherWsPath(selected.id);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-muted-foreground text-sm">
            <Link
              href={buildTeamAdminPath(selected.id)}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              Team Admin
            </Link>
            <span aria-hidden className="px-1.5">
              /
            </span>
            <span className="text-foreground">Deck Manager</span>
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Move deck to another workspace
          </h1>
          <p
            className="text-muted-foreground text-sm font-medium sm:text-base truncate min-w-0"
            title={selected.name}
          >
            Workspace: {selected.name}
          </p>
          <p className="text-muted-foreground text-sm sm:text-base">
            Transfer team decks between workspaces owned by the same subscriber. Assign decks to
            members from the other tab.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <MainDashboardButton
            teamId={isTeamPlanId(selected.planSlug) ? selected.id : null}
            href={mainDashboardHref}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deck Manager</CardTitle>
          <CardDescription>
            Assign decks to members or transfer decks between subscriber-owned workspaces.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamDeckAssignList
            workspaces={assignWorkspaceSnapshots}
            defaultWorkspaceId={selected.id}
            userFieldDisplayById={userFieldDisplayById}
            deckManagerTabUrls={{ assignMembersHref: assignHref, moveDeckHref: moveHref }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
