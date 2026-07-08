import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  Clock,
  History,
  Layers,
  Mail,
  Send,
  Shield,
  Timer,
  UserPlus,
  Users,
} from "lucide-react";
import {
  isTeamAdminAssignDecksToMembersPath,
  isTeamAdminInviteHistoryPath,
  isTeamAdminInvitePendingPath,
  isTeamAdminInviteSendPath,
  isTeamAdminMembersHistoryPath,
  isTeamAdminMembersPath,
  isTeamAdminQuizResultsPath,
  isTeamAdminQuizSchedulePath,
  isTeamAdminQuizSecurityPath,
  isTeamAdminQuizTimerPath,
  isTeamAdminStudyPrivilegesPath,
  isTeamAdminWsHistoryPath,
  TEAM_ADMIN_ASSIGN_DECKS_TO_MEMBERS_PATH,
  TEAM_ADMIN_INVITE_HISTORY_PATH,
  TEAM_ADMIN_INVITE_PENDING_PATH,
  TEAM_ADMIN_INVITE_SEND_PATH,
  TEAM_ADMIN_MEMBERS_HISTORY_PATH,
  TEAM_ADMIN_MEMBERS_PATH,
  TEAM_ADMIN_QUIZ_RESULTS_PATH,
  TEAM_ADMIN_QUIZ_SCHEDULE_PATH,
  TEAM_ADMIN_QUIZ_SECURITY_PATH,
  TEAM_ADMIN_QUIZ_TIMER_PATH,
  TEAM_ADMIN_STUDY_PRIVILEGES_PATH,
  TEAM_ADMIN_WS_HISTORY_PATH,
} from "@/lib/team-admin-url";

export const TEAM_ADMIN_SIDEBAR_NAV_ENABLED = true;

export type TeamAdminNavItem = {
  title: string;
  path: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
};

export type TeamAdminNavSection = {
  title: string;
  description: string;
  items: TeamAdminNavItem[];
};

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
    title: "Quiz administration",
    description: "Review results and configure quiz settings.",
    items: [
      {
        title: "Quiz results",
        path: TEAM_ADMIN_QUIZ_RESULTS_PATH,
        icon: ClipboardList,
        isActive: (pathname) =>
          isTeamAdminQuizResultsPath(pathname) &&
          !isTeamAdminQuizTimerPath(pathname) &&
          !isTeamAdminQuizSchedulePath(pathname) &&
          !isTeamAdminQuizSecurityPath(pathname),
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
        title: "Quiz security",
        path: TEAM_ADMIN_QUIZ_SECURITY_PATH,
        icon: Shield,
        isActive: isTeamAdminQuizSecurityPath,
      },
    ],
  },
];

export function isTeamAdminOverviewActive(pathname: string): boolean {
  return pathname === TEAM_ADMIN_MEMBERS_PATH;
}
