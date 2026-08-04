import type { LucideIcon } from "lucide-react";
import {
  BrainCircuit,
  ClipboardList,
  Clock,
  History,
  Layers,
  LayoutList,
  ListChecks,
  Mail,
  Presentation,
  Puzzle,
  Send,
  Shield,
  Timer,
  UserPlus,
  Users,
} from "lucide-react";
import {
  isTeamAdminActiveRecallAnalyticsPath,
  isTeamAdminActiveRecallPath,
  isTeamAdminActiveRecallSessionCardsPath,
  isTeamAdminAddonsPath,
  isTeamAdminAssignDecksToMembersPath,
  isTeamAdminInviteHistoryPath,
  isTeamAdminInvitePendingPath,
  isTeamAdminInviteSendPath,
  isTeamAdminLiveClassroomPath,
  isTeamAdminMembersHistoryPath,
  isTeamAdminMembersPath,
  isTeamAdminQuizFormatsPath,
  isTeamAdminQuizResultsPath,
  isTeamAdminQuizSchedulePath,
  isTeamAdminQuizSecurityPath,
  isTeamAdminQuizTimerPath,
  isTeamAdminStudyPrivilegesPath,
  isTeamAdminWsHistoryPath,
  TEAM_ADMIN_ACTIVE_RECALL_PATH,
  TEAM_ADMIN_ACTIVE_RECALL_SESSION_CARDS_PATH,
  TEAM_ADMIN_ADDONS_PATH,
  TEAM_ADMIN_ASSIGN_DECKS_TO_MEMBERS_PATH,
  TEAM_ADMIN_INVITE_HISTORY_PATH,
  TEAM_ADMIN_INVITE_PENDING_PATH,
  TEAM_ADMIN_INVITE_SEND_PATH,
  TEAM_ADMIN_LIVE_CLASSROOM_PATH,
  TEAM_ADMIN_MEMBERS_HISTORY_PATH,
  TEAM_ADMIN_MEMBERS_PATH,
  TEAM_ADMIN_QUIZ_FORMATS_PATH,
  TEAM_ADMIN_QUIZ_RESULTS_PATH,
  TEAM_ADMIN_QUIZ_SCHEDULE_PATH,
  TEAM_ADMIN_QUIZ_SECURITY_PATH,
  TEAM_ADMIN_QUIZ_TIMER_PATH,
  TEAM_ADMIN_STUDY_PRIVILEGES_PATH,
  TEAM_ADMIN_WS_HISTORY_PATH,
} from "@/lib/team-admin-url";

export const TEAM_ADMIN_SIDEBAR_NAV_ENABLED = true;

export type TeamAdminNavLeaf = {
  title: string;
  path: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
};

export type TeamAdminNavItem = TeamAdminNavLeaf & {
  /** When set, this item is a dropdown parent; `path` is the default/first destination. */
  subItems?: TeamAdminNavLeaf[];
};

export type TeamAdminNavSection = {
  title: string;
  description: string;
  items: TeamAdminNavItem[];
};

function isQuizModePath(pathname: string): boolean {
  return (
    isTeamAdminQuizResultsPath(pathname) ||
    isTeamAdminQuizFormatsPath(pathname) ||
    isTeamAdminQuizTimerPath(pathname) ||
    isTeamAdminQuizSchedulePath(pathname) ||
    isTeamAdminQuizSecurityPath(pathname)
  );
}

export const TEAM_ADMIN_DASHBOARD_NAV: TeamAdminNavSection[] = [
  {
    title: "Team & members",
    description: "Roster, invitations, and workspace history.",
    items: [
      {
        title: "Members roster",
        path: TEAM_ADMIN_MEMBERS_PATH,
        icon: Users,
        isActive: (pathname) => pathname === TEAM_ADMIN_MEMBERS_PATH,
      },
      {
        title: "Membership history",
        path: TEAM_ADMIN_MEMBERS_HISTORY_PATH,
        icon: History,
        isActive: isTeamAdminMembersHistoryPath,
      },
      {
        title: "Send invite",
        path: TEAM_ADMIN_INVITE_SEND_PATH,
        icon: Send,
        isActive: isTeamAdminInviteSendPath,
      },
      {
        title: "Pending invitations",
        path: TEAM_ADMIN_INVITE_PENDING_PATH,
        icon: Mail,
        isActive: isTeamAdminInvitePendingPath,
      },
      {
        title: "Invitation history",
        path: TEAM_ADMIN_INVITE_HISTORY_PATH,
        icon: UserPlus,
        isActive: isTeamAdminInviteHistoryPath,
      },
      {
        title: "Workspace history",
        path: TEAM_ADMIN_WS_HISTORY_PATH,
        icon: History,
        isActive: isTeamAdminWsHistoryPath,
      },
    ],
  },
  {
    title: "Deck manager",
    description: "Assign decks and control study privileges.",
    items: [
      {
        title: "Assign decks",
        path: TEAM_ADMIN_ASSIGN_DECKS_TO_MEMBERS_PATH,
        icon: Layers,
        isActive: isTeamAdminAssignDecksToMembersPath,
      },
      {
        title: "Study privileges",
        path: TEAM_ADMIN_STUDY_PRIVILEGES_PATH,
        icon: Shield,
        isActive: isTeamAdminStudyPrivilegesPath,
      },
    ],
  },
  {
    title: "Add-ons",
    description:
      "Member add-ons and organization add-ons such as Live Classroom™.",
    items: [
      {
        title: "Member add-ons",
        path: TEAM_ADMIN_ADDONS_PATH,
        icon: Puzzle,
        isActive: isTeamAdminAddonsPath,
      },
      {
        title: "Live Classroom™",
        path: TEAM_ADMIN_LIVE_CLASSROOM_PATH,
        icon: Presentation,
        isActive: isTeamAdminLiveClassroomPath,
      },
    ],
  },
  {
    title: "Study Modes",
    description:
      "Active Recall analytics and Quiz Mode settings for the workspace.",
    items: [
      {
        title: "Active Recall Mode",
        path: TEAM_ADMIN_ACTIVE_RECALL_PATH,
        icon: BrainCircuit,
        isActive: isTeamAdminActiveRecallPath,
        subItems: [
          {
            title: "Performance",
            path: TEAM_ADMIN_ACTIVE_RECALL_PATH,
            icon: BrainCircuit,
            isActive: isTeamAdminActiveRecallAnalyticsPath,
          },
          {
            title: "Session cards",
            path: TEAM_ADMIN_ACTIVE_RECALL_SESSION_CARDS_PATH,
            icon: LayoutList,
            isActive: isTeamAdminActiveRecallSessionCardsPath,
          },
        ],
      },
      {
        title: "Quiz Mode",
        path: TEAM_ADMIN_QUIZ_RESULTS_PATH,
        icon: ClipboardList,
        isActive: isQuizModePath,
        subItems: [
          {
            title: "Quiz results",
            path: TEAM_ADMIN_QUIZ_RESULTS_PATH,
            icon: ClipboardList,
            isActive: (pathname) =>
              isTeamAdminQuizResultsPath(pathname) &&
              !isTeamAdminQuizTimerPath(pathname) &&
              !isTeamAdminQuizSchedulePath(pathname) &&
              !isTeamAdminQuizSecurityPath(pathname) &&
              !isTeamAdminQuizFormatsPath(pathname),
          },
          {
            title: "Quiz formats",
            path: TEAM_ADMIN_QUIZ_FORMATS_PATH,
            icon: ListChecks,
            isActive: isTeamAdminQuizFormatsPath,
          },
          {
            title: "Quiz timer",
            path: TEAM_ADMIN_QUIZ_TIMER_PATH,
            icon: Timer,
            isActive: isTeamAdminQuizTimerPath,
          },
          {
            title: "Quiz schedule",
            path: TEAM_ADMIN_QUIZ_SCHEDULE_PATH,
            icon: Clock,
            isActive: isTeamAdminQuizSchedulePath,
          },
          {
            title: "Exam Mode",
            path: TEAM_ADMIN_QUIZ_SECURITY_PATH,
            icon: Shield,
            isActive: isTeamAdminQuizSecurityPath,
          },
        ],
      },
    ],
  },
];

export function countTeamAdminNavLeaves(
  sections: TeamAdminNavSection[] = TEAM_ADMIN_DASHBOARD_NAV,
): number {
  return sections.reduce(
    (count, section) =>
      count +
      section.items.reduce(
        (itemCount, item) => itemCount + (item.subItems?.length ?? 1),
        0,
      ),
    0,
  );
}

export function isTeamAdminOverviewActive(pathname: string): boolean {
  return pathname === TEAM_ADMIN_MEMBERS_PATH;
}
