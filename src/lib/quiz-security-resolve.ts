export type QuizSecuritySettingFields = {
  quizSecurityEnabled: boolean | null;
};

export function resolveQuizSecurityEnabled(
  deck: QuizSecuritySettingFields,
  workspace: { quizSecurityEnabled: boolean },
): boolean {
  if (deck.quizSecurityEnabled !== null && deck.quizSecurityEnabled !== undefined) {
    return deck.quizSecurityEnabled;
  }
  return workspace.quizSecurityEnabled;
}

export function nextDeckQuizSecurityExplicit(
  workspaceEnabled: boolean,
  checked: boolean,
): boolean | null {
  return checked === workspaceEnabled ? null : checked;
}
