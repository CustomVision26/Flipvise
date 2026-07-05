/**
 * Turbopack: load team-admin client UI via `next/dynamic` from Server Components.
 * Do not statically import `"use client"` modules from team-admin pages.
 */
import dynamic from "next/dynamic";

const clientLoading = () => null;

export const TeamAdminPanelScroll = dynamic(
  () => import("@/components/team-admin-panel-scroll").then((mod) => mod.TeamAdminPanelScroll),
  { loading: clientLoading },
);

export const TeamAdminQuickNavPanel = dynamic(
  () =>
    import("@/components/team-admin-quick-nav-panel").then((mod) => mod.TeamAdminQuickNavPanel),
  { loading: clientLoading },
);

export const TeamAdminWorkspaceStatsPanel = dynamic(
  () =>
    import("@/components/team-admin-workspace-stats-panel").then(
      (mod) => mod.TeamAdminWorkspaceStatsPanel,
    ),
  { loading: clientLoading },
);

export const TeamAdminManageTabs = dynamic(
  () => import("@/components/team-admin-manage-tabs").then((mod) => mod.TeamAdminManageTabs),
  { loading: clientLoading },
);

export const AddTeamDialog = dynamic(
  () => import("@/components/add-team-dialog").then((mod) => mod.AddTeamDialog),
  { loading: clientLoading },
);

export const TeamDeckManagerSubTabs = dynamic(
  () => import("@/components/team-deck-manager-sub-tabs").then((mod) => mod.TeamDeckManagerSubTabs),
  { loading: clientLoading },
);

export const TeamDeckAssignListLoader = dynamic(
  () =>
    import("@/components/team-deck-assign-list-loader").then((mod) => mod.TeamDeckAssignListLoader),
  { loading: clientLoading },
);

export const TeamStudyPrivilegesTable = dynamic(
  () =>
    import("@/components/team-study-privileges-table").then((mod) => mod.TeamStudyPrivilegesTable),
  { loading: clientLoading },
);

export const TeamQuizFormatsSettings = dynamic(
  () => import("@/components/team-quiz-formats-settings").then((mod) => mod.TeamQuizFormatsSettings),
  { loading: clientLoading },
);

export const TeamQuizResultsSubTabs = dynamic(
  () => import("@/components/team-quiz-results-sub-tabs").then((mod) => mod.TeamQuizResultsSubTabs),
  { loading: clientLoading },
);

export const TeamQuizTimerSettings = dynamic(
  () => import("@/components/team-quiz-timer-settings").then((mod) => mod.TeamQuizTimerSettings),
  { loading: clientLoading },
);

export const TeamQuizScheduleSettings = dynamic(
  () =>
    import("@/components/team-quiz-schedule-settings").then((mod) => mod.TeamQuizScheduleSettings),
  { loading: clientLoading },
);

export const TeamQuizSecuritySettings = dynamic(
  () =>
    import("@/components/team-quiz-security-settings").then((mod) => mod.TeamQuizSecuritySettings),
  { loading: clientLoading },
);

export const TeamQuizSecuritySessionsTable = dynamic(
  () =>
    import("@/components/team-quiz-security-sessions-table").then(
      (mod) => mod.TeamQuizSecuritySessionsTable,
    ),
  { loading: clientLoading },
);
