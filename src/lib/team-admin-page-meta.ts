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
  TEAM_ADMIN_MEMBERS_PATH,
} from "@/lib/team-admin-url";

export type TeamAdminPageMeta = {
  section: string;
  title: string;
  description: string;
  isOverview: boolean;
};

export function teamAdminPageMetaForPath(pathname: string): TeamAdminPageMeta {
  if (pathname === TEAM_ADMIN_MEMBERS_PATH) {
    return {
      section: "Overview",
      title: "Team admin home",
      description: "Manage teams, members, deck access, and quiz settings for your subscription.",
      isOverview: true,
    };
  }

  if (isTeamAdminMembersHistoryPath(pathname)) {
    return {
      section: "Team & members",
      title: "Membership history",
      description:
        "When members joined or were removed from this workspace, including who performed each action.",
      isOverview: false,
    };
  }

  if (isTeamAdminWsHistoryPath(pathname)) {
    return {
      section: "Team & members",
      title: "Workspace history",
      description:
        "When this workspace was created, renamed, or removed. Each row is recorded at the time the change happened.",
      isOverview: false,
    };
  }

  if (isTeamAdminInviteSendPath(pathname)) {
    return {
      section: "Team & members",
      title: "Send invite",
      description:
        "Choose a workspace, then enter an email and role. Subscribers see every workspace they own; co-admins only see workspaces they were invited to manage.",
      isOverview: false,
    };
  }

  if (isTeamAdminInvitePendingPath(pathname)) {
    return {
      section: "Team & members",
      title: "Pending invitations",
      description: "Active invites for this workspace. Revoke to withdraw a link before it is accepted or expires.",
      isOverview: false,
    };
  }

  if (isTeamAdminInviteHistoryPath(pathname)) {
    return {
      section: "Team & members",
      title: "Invitation history",
      description: "Accepted, declined, expired, and revoked invitations for this workspace.",
      isOverview: false,
    };
  }

  if (isTeamAdminAssignDecksToMembersPath(pathname)) {
    return {
      section: "Deck manager",
      title: "Assign decks",
      description: "Link personal decks to this workspace, then assign them to members or co-admins.",
      isOverview: false,
    };
  }

  if (isTeamAdminStudyPrivilegesPath(pathname)) {
    return {
      section: "Deck manager",
      title: "Study privileges",
      description: "Control which study modes regular members may use for each assigned deck.",
      isOverview: false,
    };
  }

  if (
    isTeamAdminQuizResultsPath(pathname) &&
    !isTeamAdminQuizTimerPath(pathname) &&
    !isTeamAdminQuizSchedulePath(pathname) &&
    !isTeamAdminQuizSecurityPath(pathname)
  ) {
    return {
      section: "Quiz administration",
      title: "Quiz results",
      description: "Review member quiz attempts across your workspaces.",
      isOverview: false,
    };
  }

  if (isTeamAdminQuizTimerPath(pathname)) {
    return {
      section: "Quiz administration",
      title: "Quiz timer",
      description:
        "Set one quiz time for all workspaces, or allow custom presets per workspace.",
      isOverview: false,
    };
  }

  if (isTeamAdminQuizSchedulePath(pathname)) {
    return {
      section: "Quiz administration",
      title: "Quiz schedule",
      description: "Configure when quizzes may start for this workspace.",
      isOverview: false,
    };
  }

  if (isTeamAdminQuizSecurityPath(pathname)) {
    return {
      section: "Quiz administration",
      title: "Quiz security",
      description: "Manage quiz lock settings and review locked sessions.",
      isOverview: false,
    };
  }

  if (isTeamAdminMembersPath(pathname)) {
    return {
      section: "Team & members",
      title: "Members roster",
      description: "Change roles or remove members. Double-click a row to view member details.",
      isOverview: false,
    };
  }

  return {
    section: "Team admin",
    title: "Dashboard",
    description: "Manage your team workspace.",
    isOverview: false,
  };
}
