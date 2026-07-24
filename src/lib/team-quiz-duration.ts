/** Default timed-quiz length for team workspace quizzes (minutes). */
export const DEFAULT_TEAM_QUIZ_DURATION_MINUTES = 10;

export const MIN_TEAM_QUIZ_DURATION_MINUTES = 1;

export const MAX_TEAM_QUIZ_DURATION_MINUTES = 180;

export function resolveTeamQuizDurationMinutes(
  stored: number | null | undefined,
): number {
  if (stored == null || !Number.isFinite(stored)) {
    return DEFAULT_TEAM_QUIZ_DURATION_MINUTES;
  }
  const rounded = Math.round(stored);
  return Math.min(
    MAX_TEAM_QUIZ_DURATION_MINUTES,
    Math.max(MIN_TEAM_QUIZ_DURATION_MINUTES, rounded),
  );
}

export function teamQuizDurationSeconds(minutes: number): number {
  return resolveTeamQuizDurationMinutes(minutes) * 60;
}

export type TeamQuizDurationContext = {
  /** Minutes used when a member starts a quiz in this workspace. */
  effectiveMinutes: number;
  /** Subscriber default quiz minutes for decks linked to owned workspaces. */
  globalDefaultMinutes: number;
  /** Non-null when this workspace has its own override. */
  workspaceOverrideMinutes: number | null;
  /**
   * When true, {@link effectiveMinutes} is always {@link globalDefaultMinutes}
   * for every owned workspace (and synced onto all linked decks).
   */
  enforceDefaultForAllWorkspaces: boolean;
  ownerUserId: string;
};

export type OwnerQuizDefaultSettings = {
  defaultQuizDurationMinutes: number;
  enforceDefaultForAllWorkspaces: boolean;
};

export type QuizTimerWorkspaceSnapshot = {
  id: number;
  name: string;
  workspaceOverrideMinutes: number | null;
  effectiveMinutes: number;
};

/** Per-deck timed-quiz length for Team Admin Quiz Timer. */
export type QuizTimerDeckSnapshot = {
  id: number;
  name: string;
  /** Null means inherit the workspace/subscriber effective minutes. */
  quizDurationMinutes: number | null;
};
