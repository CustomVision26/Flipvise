import { cookies } from "next/headers";
import { auth } from "@/lib/clerk-auth";
import { redirect } from "next/navigation";
import { Users, LayoutGrid } from "lucide-react";
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
  listPendingInvitations,
  listTeamInvitationHistoryForTeam,
  listTeamMembers,
  countMembersForTeam,
  countPendingInvitationsForTeam,
  getLatestInviteeDisplayNamesForTeamIds,
  roleReceivesDeckAssignments,
} from "@/db/queries/teams";
import {
  canonicalTeamPlanId,
  isTeamPlanId,
  limitsForPlan,
  personalDashboardPlanQueryValue,
} from "@/lib/team-plans";
import {
  buildTeamAdminAssignDecksToMembersPath,
  buildTeamAdminInviteHistoryPath,
  buildTeamAdminInvitePendingPath,
  buildTeamAdminInviteSendPath,
  buildTeamAdminMembersPath,
  buildTeamAdminQuizResultsPath,
  buildTeamAdminWsHistoryPath,
} from "@/lib/team-admin-url";
import { resolveTeamAdminDashboardSelection } from "@/lib/resolve-team-admin-dashboard-selection";
import { listTeamWorkspaceEventsForTeam } from "@/db/queries/team-workspace-events";
import { getQuizResultsForTeam } from "@/db/queries/quiz-results";
import { TeamAdminManageTabs } from "@/components/team-admin-manage-tabs";
import { TeamAdminDashboardNavActions } from "@/components/team-admin-dashboard-nav-actions";
import {
  getClerkPrimaryEmailsByUserIds,
  getClerkUserDisplayNameById,
  getClerkUserFieldDisplaysByIds,
} from "@/lib/clerk-user-display";
import { AddTeamDialogLazy } from "@/components/add-team-dialog-lazy";
import { getAccessContext } from "@/lib/access";
import { TeamAdminWorkspaceDeckCardTotals } from "@/components/team-admin-workspace-deck-card-totals";

interface PageProps {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
    userid?: string;
    plan?: string;
  }>;
  /** Used when redirecting to canonical `?team=&teamMemberId=` — must match the current route (members vs ws-history). */
  buildCanonicalPath?: (teamId: number, teamMemberUrlParam: number) => string;
}

export default async function TeamAdminDashboardView({
  searchParams,
  buildCanonicalPath = buildTeamAdminMembersPath,
}: PageProps) {
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
    buildCanonicalPath,
  });
  if (resolution.outcome === "redirect") {
    redirect(resolution.to);
  }
  const { selected, teamsForSubscriber, subscriberTeamIds, viewerTeamMemberUrlParam } =
    resolution;

  const limits = isTeamPlanId(selected.planSlug)
    ? limitsForPlan(selected.planSlug)
    : { maxTeams: 0, maxMembersPerTeam: 0, maxDecksPerWorkspace: 0 };

  const [
    [
      memberCount,
      members,
      invitations,
      invitationHistory,
      workspaceHistory,
      teamDecksWithCardCounts,
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
      getDecksForTeamWithCardCount(selected.id, selected.ownerUserId),
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
          normalMembers: allMembers.filter((m) => roleReceivesDeckAssignments(m.role)),
          allMembers,
          decks,
          assignments,
        };
      }),
    ),
  ]);

  const memberTableUserIds = [
    selected.ownerUserId,
    ...members.map((m) => m.userId),
    ...members.map((m) => m.addedByUserId).filter((id): id is string => Boolean(id)),
    ...teamQuizResults.map((r) => r.userId),
  ];
  const assignMemberUserIds = assignWorkspaceSnapshots.flatMap((w) =>
    w.allMembers.map((m) => m.userId),
  );
  const assignmentSignerUserIds = assignWorkspaceSnapshots.flatMap((w) =>
    w.assignments
      .map((a) => a.assignedByUserId)
      .filter((id): id is string => Boolean(id)),
  );
  const workspaceOwnerUserIds = assignWorkspaceSnapshots.map((w) => w.ownerUserId);
  const invitationInviterUserIds = [
    ...invitations.map((i) => i.invitedByUserId),
    ...invitationHistory.map((i) => i.invitedByUserId),
  ].filter((id): id is string => Boolean(id));
  const [userFieldDisplayById, access, inviteWorkspaceOptions, invitationStoredDisplayNames] =
    await Promise.all([
      getClerkUserFieldDisplaysByIds(
        [
          ...new Set([
            ...memberTableUserIds,
            ...assignMemberUserIds,
            ...assignmentSignerUserIds,
            ...workspaceOwnerUserIds,
            ...invitationInviterUserIds,
          ]),
        ],
      ),
      getAccessContext(),
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
      getLatestInviteeDisplayNamesForTeamIds(subscriberTeamIds),
    ]);

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

  const memberEmailToDisplayHint: Record<string, string> = {};
  for (const snap of assignWorkspaceSnapshots) {
    for (const m of snap.allMembers) {
      const disp = userFieldDisplayById[m.userId];
      const em = disp?.primaryEmail?.toLowerCase();
      if (em && disp?.primaryLine) {
        memberEmailToDisplayHint[em] = disp.primaryLine;
      }
    }
  }
  const inviteDisplayHintsByEmail: Record<string, string> = {
    ...memberEmailToDisplayHint,
    ...invitationStoredDisplayNames,
  };

  const subscriberOwnerPrimaryEmail =
    userFieldDisplayById[selected.ownerUserId]?.primaryEmail?.trim().toLowerCase() ?? null;

  const isOwner = selected.ownerUserId === userId;

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
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 flex-1 space-y-2">
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
          {isOwner && isTeamPlanId(selected.planSlug) && (
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end sm:pt-0.5">
              <AddTeamDialogLazy
                planSlug={canonicalTeamPlanId(selected.planSlug)!}
                isAtLimit={teamsForSubscriber.length >= limits.maxTeams}
              />
            </div>
          )}
        </div>

        <Card className="border-border/80 bg-muted/20 shadow-none">
          <CardHeader className="space-y-1 px-4 pb-2 pt-4 sm:px-5">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Quick navigation
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground sm:text-sm">
              {isOwner
                ? "Jump to your Personal Dashboard."
                : "Jump to your Personal Dashboard or the main dashboard scoped to this workspace."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 px-4 pb-4 sm:flex-row sm:flex-wrap sm:gap-3 sm:px-5">
            <TeamAdminDashboardNavActions
              mainDashboardHref={mainDashboardHref}
              workspaceDashboardHref={workspaceDashboardHref}
              workspaceTeamId={selected.id}
              isOwner={isOwner}
              workspacePlanSlug={selected.planSlug}
              className="sm:justify-start"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Workspaces
              </CardTitle>
              <LayoutGrid className="h-4 w-4 text-muted-foreground" aria-hidden />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {teamsForSubscriber.length}
              <span className="text-lg font-normal text-muted-foreground"> / {limits.maxTeams}</span>
            </p>
            <CardDescription className="mt-0.5">Active subscriber-owned workspaces</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Members
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {memberCount}
              <span className="text-lg font-normal text-muted-foreground"> / {limits.maxMembersPerTeam}</span>
            </p>
            <CardDescription className="mt-0.5">Members in this workspace</CardDescription>
          </CardContent>
        </Card>
        <TeamAdminWorkspaceDeckCardTotals
          teamDecksWithCardCounts={teamDecksWithCardCounts}
          planSlug={selected.planSlug}
        />
      </div>

      <TeamAdminManageTabs
        key={selected.id}
        teamId={selected.id}
        deckManagerHref={buildTeamAdminAssignDecksToMembersPath(
          selected.id,
          viewerTeamMemberUrlParam,
        )}
        membersHref={buildTeamAdminMembersPath(selected.id, viewerTeamMemberUrlParam)}
        workspaceHistoryHref={buildTeamAdminWsHistoryPath(
          selected.id,
          viewerTeamMemberUrlParam,
        )}
        inviteSendHref={buildTeamAdminInviteSendPath(selected.id, viewerTeamMemberUrlParam)}
        invitePendingHref={buildTeamAdminInvitePendingPath(
          selected.id,
          viewerTeamMemberUrlParam,
        )}
        inviteHistoryHref={buildTeamAdminInviteHistoryPath(
          selected.id,
          viewerTeamMemberUrlParam,
        )}
        quizResultsHref={buildTeamAdminQuizResultsPath(
          selected.id,
          viewerTeamMemberUrlParam,
        )}
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
        inviteDisplayHintsByEmail={inviteDisplayHintsByEmail}
        subscriberOwnerPrimaryEmail={subscriberOwnerPrimaryEmail}
        teamQuizResults={teamQuizResults}
      />
    </div>
  );
}
