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
  listPendingInvitations,
  listTeamInvitationHistoryForTeam,
  listTeamMembers,
  countMembersForTeam,
  countPendingInvitationsForTeam,
} from "@/db/queries/teams";
import { isTeamPlanId, limitsForPlan } from "@/lib/team-plans";
import { buildTeamAdminPath } from "@/lib/team-admin-url";
import { buildResolvedTeamWorkspaceQueryString } from "@/lib/resolve-team-workspace-url";
import { listTeamWorkspaceEventsForTeam } from "@/db/queries/team-workspace-events";
import { getQuizResultsForTeam } from "@/db/queries/quiz-results";
import { TeamAdminManageTabs } from "@/components/team-admin-manage-tabs";
import { AddTeamDialog } from "@/components/add-team-dialog";
import { MainDashboardButton } from "@/components/main-dashboard-button";
import {
  getClerkPrimaryEmailsByUserIds,
  getClerkUserDisplayNameById,
  getClerkUserFieldDisplaysByIds,
} from "@/lib/clerk-user-display";

interface PageProps {
  searchParams: Promise<{ team?: string; userid?: string; plan?: string }>;
}

export default async function TeamAdminDashboardPage({ searchParams }: PageProps) {
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

  const rawFromQuery =
    teamParam != null &&
    teamParam !== "" &&
    !Number.isNaN(Number(teamParam))
      ? Number(teamParam)
      : NaN;

  const teamIdSet = new Set(teams.map((t) => t.id));
  const fromQuery =
    Number.isFinite(rawFromQuery) && teamIdSet.has(rawFromQuery)
      ? teams.find((t) => t.id === rawFromQuery)
      : undefined;

  const cookieStore = await cookies();
  const cookieRaw = cookieStore.get(TEAM_CONTEXT_COOKIE)?.value;
  const rawFromCookie =
    cookieRaw != null &&
    cookieRaw !== "" &&
    !Number.isNaN(Number(cookieRaw))
      ? Number(cookieRaw)
      : NaN;
  const fromCookie =
    Number.isFinite(rawFromCookie) && teamIdSet.has(rawFromCookie)
      ? teams.find((t) => t.id === rawFromCookie)
      : undefined;

  const selected = fromQuery ?? fromCookie ?? teams[0] ?? null;
  if (!selected) redirect("/onboarding/team");

  const subscriberForWorkspace = selected.ownerUserId;
  /** Workspaces this subscriber owns; excludes other subscribers’ teams where the user is only co-admin. */
  const teamsForSubscriber = teams.filter(
    (t) => t.ownerUserId === subscriberForWorkspace,
  );
  const teamQueryMatches =
    Number.isFinite(rawFromQuery) && rawFromQuery === selected.id;
  const useridMatches = useridParam === subscriberForWorkspace;

  const expectedPlanQuery = isTeamPlanId(selected.planSlug)
    ? selected.planSlug
    : null;
  const planNorm = planParam?.toLowerCase() ?? "";
  const planQueryMatches =
    expectedPlanQuery === null
      ? planNorm === ""
      : planNorm === expectedPlanQuery.toLowerCase() || planNorm === "pro";

  /** Canonical URL: subscriber (`userid`) + workspace (`team`) + team-tier `plan` when applicable. */
  if (!teamQueryMatches || !useridMatches || !planQueryMatches) {
    redirect(
      buildTeamAdminPath(
        subscriberForWorkspace,
        selected.id,
        expectedPlanQuery,
      ),
    );
  }

  const limits = isTeamPlanId(selected.planSlug)
    ? limitsForPlan(selected.planSlug)
    : { maxTeams: 0, maxMembersPerTeam: 0 };

  const [
    [
      memberCount,
      members,
      invitations,
      invitationHistory,
      workspaceHistory,
      teamDecks,
      ownerDisplayName,
      teamQuizResults,
    ],
    assignWorkspaceSnapshots,
  ] = await Promise.all([
    Promise.all([
      countMembersForTeam(selected.id),
      listTeamMembers(selected.id),
      listPendingInvitations(selected.id),
      listTeamInvitationHistoryForTeam(selected.id),
      listTeamWorkspaceEventsForTeam(selected.ownerUserId, selected.id),
      getDecksForTeam(selected.id, selected.ownerUserId),
      getClerkUserDisplayNameById(selected.ownerUserId),
      getQuizResultsForTeam(selected.id),
    ]),
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
          normalMembers: allMembers.filter((m) => m.role === "team_member"),
          decks,
          assignments,
        };
      }),
    ),
  ]);

  const isOwner = selected.ownerUserId === userId;

  const memberTableUserIds = [
    selected.ownerUserId,
    ...members.map((m) => m.userId),
    ...members.map((m) => m.addedByUserId).filter((id): id is string => Boolean(id)),
    ...teamQuizResults.map((r) => r.userId),
  ];
  const assignMemberUserIds = assignWorkspaceSnapshots.flatMap((w) =>
    w.normalMembers.map((m) => m.userId),
  );
  const invitationInviterUserIds = [
    ...invitations.map((i) => i.invitedByUserId),
    ...invitationHistory.map((i) => i.invitedByUserId),
  ].filter((id): id is string => Boolean(id));
  const [userFieldDisplayById, mainDashboardHref, inviteWorkspaceOptions] = await Promise.all([
    getClerkUserFieldDisplaysByIds(
      [...new Set([...memberTableUserIds, ...assignMemberUserIds, ...invitationInviterUserIds])],
    ),
    (async () =>
      isTeamPlanId(selected.planSlug)
        ? `/dashboard?${await buildResolvedTeamWorkspaceQueryString(userId, {
            teamId: selected.id,
            ownerUserId: selected.ownerUserId,
            canEditTeamDecks: true,
            isAssignedMemberPreview: false,
            workspacePlanQuery: selected.planSlug,
          })}`
        : "/dashboard")(),
    Promise.all(
      teamsForSubscriber.map(async (t) => {
        const lim = isTeamPlanId(t.planSlug)
          ? limitsForPlan(t.planSlug)
          : { maxMembersPerTeam: 0 };
        const [m, p, memberRows] = await Promise.all([
          countMembersForTeam(t.id),
          countPendingInvitationsForTeam(t.id),
          listTeamMembers(t.id),
        ]);
        const acceptedMemberEmails = await getClerkPrimaryEmailsByUserIds(
          memberRows.map((row) => row.userId),
        );
        return {
          id: t.id,
          name: t.name,
          atCapacity: m + p >= lim.maxMembersPerTeam,
          acceptedMemberEmails,
        };
      }),
    ),
  ]);

  const ownedWorkspaceInviteOptions = inviteWorkspaceOptions.filter((opt) => {
    const t = teamsForSubscriber.find((x) => x.id === opt.id);
    return t?.ownerUserId === userId;
  });
  const inviteAggregatedMemberEmails =
    ownedWorkspaceInviteOptions.length > 0
      ? [...new Set(ownedWorkspaceInviteOptions.flatMap((w) => w.acceptedMemberEmails))].sort(
          (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }),
        )
      : undefined;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Team Admin Dashboard</h1>
            <p
              className="text-lg font-semibold tracking-tight text-foreground sm:text-xl truncate min-w-0"
              title={ownerDisplayName}
            >
              {ownerDisplayName}
            </p>
            <p
              className="text-sm font-medium text-muted-foreground sm:text-base truncate min-w-0"
              title={selected.name}
            >
              {selected.name}
            </p>
            <p className="text-muted-foreground text-sm sm:text-base">
              Manage teams, members, and deck access for your subscription.
            </p>
          </div>
          <div className="flex flex-shrink-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {isOwner && isTeamPlanId(selected.planSlug) && (
                <AddTeamDialog
                  planSlug={selected.planSlug}
                  isAtLimit={teamsForSubscriber.length >= limits.maxTeams}
                />
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <MainDashboardButton
            teamId={isTeamPlanId(selected.planSlug) ? selected.id : null}
            href={mainDashboardHref}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Teams/Workspaces
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {teamsForSubscriber.length} / {limits.maxTeams}
            </p>
            <CardDescription>Subscriber-owned workspaces on this plan</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Members (this team)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {memberCount} / {limits.maxMembersPerTeam}
            </p>
            <CardDescription>Actual member/s</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Decks (this team)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{teamDecks.length}</p>
            <CardDescription>Team-scoped decks</CardDescription>
          </CardContent>
        </Card>
      </div>

      <TeamAdminManageTabs
        key={selected.id}
        teamId={selected.id}
        teamName={selected.name}
        ownerUserId={selected.ownerUserId}
        teamCreatedAt={selected.createdAt}
        currentUserId={userId}
        isOwner={isOwner}
        workspaces={inviteWorkspaceOptions}
        inviteAggregatedMemberEmails={inviteAggregatedMemberEmails}
        defaultWorkspaceId={selected.id}
        members={members}
        userFieldDisplayById={userFieldDisplayById}
        pendingInvitations={invitations}
        invitationHistory={invitationHistory}
        workspaceHistory={workspaceHistory}
        assignWorkspaceSnapshots={assignWorkspaceSnapshots}
        teamQuizResults={teamQuizResults}
      />
    </div>
  );
}
