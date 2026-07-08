import {
  getDecksForTeam,
  getDecksForTeamWithCardCount,
  listAssignmentsForTeam,
  listPendingInvitations,
  listTeamInvitationHistoryForTeam,
  listTeamMembers,
  getLatestInviteeDisplayNamesForTeamIds,
  roleReceivesDeckAssignments,
} from "@/db/queries/teams";
import {
  countMembersWithinSubscriptionLimit,
  enforceSubscriptionPlanLimitsForOwner,
  teamMemberInviteCapacity,
} from "@/db/queries/team-plan-limits";
import { selectNewestMembersWithinMemberLimit } from "@/lib/team-plan-limit-selection";
import { isWorkspaceSubscriptionPlanSlug } from "@/lib/education-plans";
import { limitsForPlan } from "@/lib/team-plans";
import {
  buildTeamAdminAssignDecksToMembersPath,
  buildTeamAdminInviteHistoryPath,
  buildTeamAdminInvitePendingPath,
  buildTeamAdminInviteSendPath,
  buildTeamAdminMembersPath,
  buildTeamAdminMembersHistoryPath,
  buildTeamAdminQuizResultsPath,
  buildTeamAdminQuizSchedulePath,
  buildTeamAdminQuizSecurityPath,
  buildTeamAdminQuizTimerPath,
  buildTeamAdminWsHistoryPath,
} from "@/lib/team-admin-url";
import { loadTeamAdminPageContext } from "@/lib/load-team-admin-page-context";
import { TEAM_ADMIN_SIDEBAR_NAV_ENABLED } from "@/lib/team-admin-dashboard-nav";
import { teamAdminPageMetaForPath } from "@/lib/team-admin-page-meta";
import { listTeamWorkspaceEventsForTeam } from "@/db/queries/team-workspace-events";
import { listTeamMemberHistoryForTeam } from "@/db/queries/team-member-history";
import { getQuizResultsForTeam } from "@/db/queries/quiz-results";
import {
  getClerkPrimaryEmailsByUserIds,
  getClerkUserDisplayNameById,
  getClerkUserFieldDisplaysByIds,
} from "@/lib/clerk-user-display";
import {
  AddTeamDialog,
  TeamAdminManageTabs,
  TeamAdminQuickNavPanel,
  TeamAdminWorkspaceStatsPanel,
} from "@/lib/team-admin-dynamic-components";
import { TeamAdminHome } from "@/components/team-admin-home";
import { TeamAdminPageChrome } from "@/components/team-admin-page-chrome";

interface TeamAdminDashboardViewProps {
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
}: TeamAdminDashboardViewProps) {
  const ctx = await loadTeamAdminPageContext(buildCanonicalPath, searchParams);
  const {
    userId,
    selected,
    teamsForSubscriber,
    subscriberTeamIds,
    viewerTeamMemberUrlParam,
    isOwner,
    planLabel,
    mainDashboardHref,
    workspaceDashboardHref,
    showTeacherDashboard,
  } = ctx;

  const pageMeta = teamAdminPageMetaForPath(buildCanonicalPath(0, 0).split("?")[0] ?? "");
  const limits = limitsForPlan(selected.planSlug);

  const [
    [
      memberCount,
      members,
      invitations,
      invitationHistory,
      workspaceHistory,
      memberHistory,
      teamDecksWithCardCounts,
      ownerDisplayName,
      workspaceQuizSnapshots,
    ],
    assignWorkspaceSnapshots,
  ] = await Promise.all([
    Promise.all([
      countMembersWithinSubscriptionLimit(selected.id, selected.planSlug),
      listTeamMembers(selected.id),
      listPendingInvitations(selected.id),
      listTeamInvitationHistoryForTeam(selected.id),
      listTeamWorkspaceEventsForTeam(selected.ownerUserId, selected.id),
      listTeamMemberHistoryForTeam(selected.ownerUserId, selected.id),
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
          normalMembers: selectNewestMembersWithinMemberLimit(
            allMembers.filter((m) => roleReceivesDeckAssignments(m.role)),
            t.planSlug,
          ),
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
  const memberHistoryUserIds = [
    ...memberHistory.map((h) => h.memberUserId),
    ...memberHistory.map((h) => h.actorUserId).filter((id): id is string => Boolean(id)),
  ];
  const [userFieldDisplayById, inviteWorkspaceOptions, invitationStoredDisplayNames] =
    await Promise.all([
      getClerkUserFieldDisplaysByIds(
        [
          ...new Set([
            ...memberTableUserIds,
            ...assignMemberUserIds,
            ...assignmentSignerUserIds,
            ...workspaceOwnerUserIds,
            ...invitationInviterUserIds,
            ...memberHistoryUserIds,
          ]),
        ],
      ),
      Promise.all(
        teamsForSubscriber.map(async (t) => {
          const [capacity, memberRows] = await Promise.all([
            teamMemberInviteCapacity(t.planSlug, t.id),
            listTeamMembers(t.id),
          ]);
          const acceptedMemberEmails = await getClerkPrimaryEmailsByUserIds(
            memberRows.map((row) => row.userId),
          );
          return {
            id: t.id,
            name: t.name,
            atCapacity: capacity.atCapacity,
            acceptedMemberEmails,
          };
        }),
      ),
      getLatestInviteeDisplayNamesForTeamIds(subscriberTeamIds),
    ]);

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

  const selectedAssignSnapshot = assignWorkspaceSnapshots.find((w) => w.id === selected.id);
  const deckNameById = new Map(
    (selectedAssignSnapshot?.decks ?? []).map((d) => [d.id, d.name] as const),
  );
  const deckNamesByMemberUserId: Record<string, string[]> = {};
  for (const a of selectedAssignSnapshot?.assignments ?? []) {
    const deckName = deckNameById.get(a.deckId);
    if (!deckName) continue;
    const existing = deckNamesByMemberUserId[a.memberUserId] ?? [];
    if (!existing.includes(deckName)) {
      deckNamesByMemberUserId[a.memberUserId] = [...existing, deckName];
    }
  }
  for (const uid of Object.keys(deckNamesByMemberUserId)) {
    deckNamesByMemberUserId[uid]!.sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }
  const workspaceDeckNames = [...deckNameById.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );

  if (isOwner && isWorkspaceSubscriptionPlanSlug(selected.planSlug)) {
    await enforceSubscriptionPlanLimitsForOwner(selected.ownerUserId, selected.planSlug);
  }

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

  const quickNavDescription = isOwner
    ? "Return to your personal dashboard to create and edit decks."
    : "Open your personal dashboard or the workspace-scoped main dashboard.";

  const manageTabs = (
    <TeamAdminManageTabs
      key={selected.id}
      teamId={selected.id}
      deckManagerHref={buildTeamAdminAssignDecksToMembersPath(
        selected.id,
        viewerTeamMemberUrlParam,
      )}
      membersHref={buildTeamAdminMembersPath(selected.id, viewerTeamMemberUrlParam)}
      membersHistoryHref={buildTeamAdminMembersHistoryPath(
        selected.id,
        viewerTeamMemberUrlParam,
      )}
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
      quizScheduleHref={buildTeamAdminQuizSchedulePath(
        selected.id,
        viewerTeamMemberUrlParam,
      )}
      quizSecurityHref={buildTeamAdminQuizSecurityPath(
        selected.id,
        viewerTeamMemberUrlParam,
      )}
      teamName={selected.name}
      deckNamesByMemberUserId={deckNamesByMemberUserId}
      workspaceDeckNames={workspaceDeckNames}
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
      memberHistory={memberHistory}
      workspaceHistory={workspaceHistory}
      inviteDisplayHintsByEmail={inviteDisplayHintsByEmail}
      subscriberOwnerPrimaryEmail={subscriberOwnerPrimaryEmail}
      workspaceQuizSnapshots={workspaceQuizSnapshots}
    />
  );

  const addTeamAside =
    isOwner && isWorkspaceSubscriptionPlanSlug(selected.planSlug) ? (
      <AddTeamDialog
        planSlug={selected.planSlug}
        isAtLimit={teamsForSubscriber.length >= limits.maxTeams}
      />
    ) : null;

  if (TEAM_ADMIN_SIDEBAR_NAV_ENABLED) {
    return (
      <TeamAdminPageChrome
        section={pageMeta.section}
        title={pageMeta.title}
        description={pageMeta.description}
        workspaceName={selected.name}
        planLabel={planLabel}
        quickNavDescription={quickNavDescription}
        mainDashboardHref={mainDashboardHref}
        workspaceDashboardHref={workspaceDashboardHref}
        workspaceTeamId={selected.id}
        workspaceTeamMemberUrlParam={viewerTeamMemberUrlParam}
        isOwner={isOwner}
        workspacePlanSlug={selected.planSlug}
        showTeacherDashboard={showTeacherDashboard}
        headerAside={pageMeta.isOverview ? addTeamAside : undefined}
      >
        {pageMeta.isOverview ? (
          <>
            <TeamAdminHome />
            <TeamAdminWorkspaceStatsPanel
              workspacesCount={teamsForSubscriber.length}
              maxWorkspaces={limits.maxTeams}
              memberCount={memberCount}
              maxMembersPerTeam={limits.maxMembersPerTeam}
              teamDecksWithCardCounts={teamDecksWithCardCounts}
              planSlug={selected.planSlug}
            />
          </>
        ) : null}
        {manageTabs}
      </TeamAdminPageChrome>
    );
  }

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
          {addTeamAside}
        </div>

        <TeamAdminQuickNavPanel
          planLabel={planLabel}
          description={quickNavDescription}
          mainDashboardHref={mainDashboardHref}
          workspaceDashboardHref={workspaceDashboardHref}
          workspaceTeamId={selected.id}
          workspaceTeamMemberUrlParam={viewerTeamMemberUrlParam}
          isOwner={isOwner}
          workspacePlanSlug={selected.planSlug}
          showTeacherDashboard={showTeacherDashboard}
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

      {manageTabs}
    </div>
  );
}
