export type QuizSecuritySettingFields = {
  quizSecurityEnabled: boolean | null;
};

export type QuizSecurityAudienceFields = {
  quizSecurityApplyToMembers: boolean | null;
  quizSecurityApplyToTeamAdmins: boolean | null;
  quizSecurityApplyToOwner: boolean | null;
};

export type QuizSecurityWorkspaceAudience = {
  quizSecurityEnabled: boolean;
  quizSecurityApplyToMembers: boolean;
  quizSecurityApplyToTeamAdmins: boolean;
  quizSecurityApplyToOwner: boolean;
};

export type QuizSecurityAudience = {
  applyToMembers: boolean;
  applyToTeamAdmins: boolean;
  applyToOwner: boolean;
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
): QuizSecurityAudience {
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
    applyToOwner:
      deck.quizSecurityApplyToOwner !== null &&
      deck.quizSecurityApplyToOwner !== undefined
        ? deck.quizSecurityApplyToOwner
        : workspace.quizSecurityApplyToOwner,
  };
}

/**
 * Whether quiz security restrictions apply to this viewer.
 * Plan owner is restricted only when applyToOwner is on (owner-only setting).
 */
export function quizSecurityAppliesToViewer(
  viewerRole: QuizSecurityViewerRole,
  audience: QuizSecurityAudience,
): boolean {
  if (viewerRole === "owner") return audience.applyToOwner;
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
  workspace: QuizSecurityAudience,
  next: QuizSecurityAudience,
): {
  applyToMembers: boolean | null;
  applyToTeamAdmins: boolean | null;
  applyToOwner: boolean | null;
} {
  const matchesWorkspace =
    next.applyToMembers === workspace.applyToMembers &&
    next.applyToTeamAdmins === workspace.applyToTeamAdmins &&
    next.applyToOwner === workspace.applyToOwner;
  if (matchesWorkspace) {
    return { applyToMembers: null, applyToTeamAdmins: null, applyToOwner: null };
  }
  return {
    applyToMembers: next.applyToMembers,
    applyToTeamAdmins: next.applyToTeamAdmins,
    applyToOwner: next.applyToOwner,
  };
}
