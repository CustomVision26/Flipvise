export type QuizSecuritySettingFields = {
  quizSecurityEnabled: boolean | null;
};

export type QuizSecurityAudienceFields = {
  quizSecurityApplyToMembers: boolean | null;
  quizSecurityApplyToTeamAdmins: boolean | null;
};

export type QuizSecurityWorkspaceAudience = {
  quizSecurityEnabled: boolean;
  quizSecurityApplyToMembers: boolean;
  quizSecurityApplyToTeamAdmins: boolean;
};

export type QuizSecurityViewerRole = "owner" | "team_admin" | "team_member";

export function resolveQuizSecurityEnabled(
  deck: QuizSecuritySettingFields,
  workspace: { quizSecurityEnabled: boolean },
): boolean {
  if (deck.quizSecurityEnabled !== null && deck.quizSecurityEnabled !== undefined) {
    return deck.quizSecurityEnabled;
  }
  return workspace.quizSecurityEnabled;
}

export function resolveQuizSecurityAudience(
  deck: QuizSecurityAudienceFields,
  workspace: Omit<QuizSecurityWorkspaceAudience, "quizSecurityEnabled">,
): { applyToMembers: boolean; applyToTeamAdmins: boolean } {
  return {
    applyToMembers:
      deck.quizSecurityApplyToMembers !== null &&
      deck.quizSecurityApplyToMembers !== undefined
        ? deck.quizSecurityApplyToMembers
        : workspace.quizSecurityApplyToMembers,
    applyToTeamAdmins:
      deck.quizSecurityApplyToTeamAdmins !== null &&
      deck.quizSecurityApplyToTeamAdmins !== undefined
        ? deck.quizSecurityApplyToTeamAdmins
        : workspace.quizSecurityApplyToTeamAdmins,
  };
}

/**
 * Whether quiz security restrictions apply to this viewer.
 * Plan owner is always restricted when security is on.
 */
export function quizSecurityAppliesToViewer(
  viewerRole: QuizSecurityViewerRole,
  audience: { applyToMembers: boolean; applyToTeamAdmins: boolean },
): boolean {
  if (viewerRole === "owner") return true;
  if (viewerRole === "team_admin") return audience.applyToTeamAdmins;
  return audience.applyToMembers;
}

export function nextDeckQuizSecurityExplicit(
  workspaceEnabled: boolean,
  checked: boolean,
): boolean | null {
  return checked === workspaceEnabled ? null : checked;
}

/** Null when matching workspace audience (inherit); otherwise explicit. */
export function nextDeckQuizSecurityAudienceExplicit(
  workspace: { applyToMembers: boolean; applyToTeamAdmins: boolean },
  next: { applyToMembers: boolean; applyToTeamAdmins: boolean },
): { applyToMembers: boolean | null; applyToTeamAdmins: boolean | null } {
  const matchesWorkspace =
    next.applyToMembers === workspace.applyToMembers &&
    next.applyToTeamAdmins === workspace.applyToTeamAdmins;
  if (matchesWorkspace) {
    return { applyToMembers: null, applyToTeamAdmins: null };
  }
  return {
    applyToMembers: next.applyToMembers,
    applyToTeamAdmins: next.applyToTeamAdmins,
  };
}
