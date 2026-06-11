import { cookies } from "next/headers";
import { auth } from "@/lib/clerk-auth";
import { redirect } from "next/navigation";
import { TEAM_CONTEXT_COOKIE } from "@/lib/team-context-cookie";
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
  labelForTeamPlanSlug,
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
  buildTeamAdminQuizSecurityPath,
  buildTeamAdminQuizTimerPath,
  buildTeamAdminWsHistoryPath,
} from "@/lib/team-admin-url";
import { resolveTeamAdminDashboardSelection } from "@/lib/resolve-team-admin-dashboard-selection";
import { listTeamWorkspaceEventsForTeam } from "@/db/queries/team-workspace-events";
import { getQuizResultsForTeam } from "@/db/queries/quiz-results";
import { TeamAdminManageTabs } from "@/components/team-admin-manage-tabs";
import { TeamAdminQuickNavPanel } from "@/components/team-admin-quick-nav-panel";
import { TeamAdminWorkspaceStatsPanel } from "@/components/team-admin-workspace-stats-panel";
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
      workspaceQuizSnapshots,
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
      Promise.all(
        teamsForSubscriber.map(async (t) => {
          const [allMembers, results] = await Promise.all([
            listTeamMembers(t.id),
            getQuizResultsForTeam(t.id),
          ]);
          return {
            teamId: t.id,
            teamName: t.name,
            ownerUserId: t.ownerUserId,
            members: allMembers,
            results,
          };
        }),
      ),
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

  const allTeamQuizResults = workspaceQuizSnapshots.flatMap((w) => w.results);

  const memberTableUserIds = [
    selected.ownerUserId,
    ...members.map((m) => m.userId),
    ...members.map((m) => m.addedByUserId).filter((id): id is string => Boolean(id)),
    ...allTeamQuizResults.map((r) => r.userId),
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

  const planLabel = labelForTeamPlanSlug(selected.planSlug) ?? selected.planSlug;

  return (
    <div className="flex flex-1 flex-col gap-8 p-4 sm:p-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Team admin
            </p>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Dashboard
              </h1>
              <p
                className="truncate text-sm font-medium text-foreground sm:text-base"
                title={ownerDisplayName}
              >
                {ownerDisplayName}
              </p>
              <p
                className="truncate text-sm text-muted-foreground"
                title={selected.name}
              >
                {selected.name}
              </p>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Manage teams, members, and deck access for your subscription.
            </p>
          </div>
          {isOwner && isTeamPlanId(selected.planSlug) ? (
            <div className="flex shrink-0 sm:justify-end">
              <AddTeamDialogLazy
                planSlug={canonicalTeamPlanId(selected.planSlug)!}
                isAtLimit={teamsForSubscriber.length >= limits.maxTeams}
              />
            </div>
          ) : null}
        </div>

        <TeamAdminQuickNavPanel
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
        workspacesCount={teamsForSubscriber.length}
        maxWorkspaces={limits.maxTeams}
        memberCount={memberCount}
        maxMembersPerTeam={limits.maxMembersPerTeam}
        teamDecksWithCardCounts={teamDecksWithCardCounts}
        planSlug={selected.planSlug}
      />

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
        quizTimerHref={buildTeamAdminQuizTimerPath(
          selected.id,
          viewerTeamMemberUrlParam,
        )}
        quizSecurityHref={buildTeamAdminQuizSecurityPath(
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
        workspaceQuizSnapshots={workspaceQuizSnapshots}
      />
    </div>
  );
}
