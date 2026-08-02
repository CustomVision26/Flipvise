/** Shared Live Classroom™ domain types (safe for client + server). */

export const LIVE_CLASSROOM_SESSION_STATUSES = [
  "scheduled",
  "lobby",
  "active",
  "paused",
  "completed",
  "cancelled",
] as const;
export type LiveClassroomSessionStatus =
  (typeof LIVE_CLASSROOM_SESSION_STATUSES)[number];

export const LIVE_CLASSROOM_SESSION_TYPES = [
  "warm_up",
  "team_battle",
  "exit_ticket",
  "review_battle",
] as const;
export type LiveClassroomSessionType =
  (typeof LIVE_CLASSROOM_SESSION_TYPES)[number];

export const LIVE_CLASSROOM_BATTLE_MODES = [
  "individual_team",
  "collaborative_team",
  "survival",
] as const;
export type LiveClassroomBattleMode =
  (typeof LIVE_CLASSROOM_BATTLE_MODES)[number];

export const LIVE_CLASSROOM_TEAM_ASSIGNMENT_MODES = [
  "manual",
  "random",
  "saved_groups",
] as const;
export type LiveClassroomTeamAssignmentMode =
  (typeof LIVE_CLASSROOM_TEAM_ASSIGNMENT_MODES)[number];

export const LIVE_CLASSROOM_CAPTAIN_MODES = [
  "rotation",
  "random",
  "fixed",
] as const;
export type LiveClassroomCaptainMode =
  (typeof LIVE_CLASSROOM_CAPTAIN_MODES)[number];

export const LIVE_CLASSROOM_STRATEGY_CARD_KINDS = [
  "double_points",
  "extra_time",
  "fifty_fifty",
  "shield",
  "ai_hint",
  "score_boost",
  "recovery",
] as const;
export type LiveClassroomStrategyCardKind =
  (typeof LIVE_CLASSROOM_STRATEGY_CARD_KINDS)[number];

export const LIVE_CLASSROOM_STRATEGY_CARD_POLICIES = [
  "unlimited",
  "limited",
  "disabled",
] as const;
export type LiveClassroomStrategyCardPolicy =
  (typeof LIVE_CLASSROOM_STRATEGY_CARD_POLICIES)[number];

export const LIVE_CLASSROOM_DIFFICULTIES = [
  "easy",
  "medium",
  "hard",
] as const;
export type LiveClassroomDifficulty =
  (typeof LIVE_CLASSROOM_DIFFICULTIES)[number];

export const LIVE_CLASSROOM_ORG_ROLES = [
  "subscription_owner",
  "team_administrator",
  "teacher",
  "student",
] as const;
export type LiveClassroomOrgRole = (typeof LIVE_CLASSROOM_ORG_ROLES)[number];

export type LiveClassroomQuestionSnapshot = {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation?: string;
  distractorExplanations?: string[];
  topic?: string;
  cardId?: number | null;
  /** Extensible for future image / drawing / math whiteboard modes. */
  media?: {
    kind: "none" | "image" | "drawing" | "math_whiteboard" | "video";
    url?: string;
  };
};

export type LiveClassroomSessionConfig = {
  questionCount: number;
  timePerQuestionSec: number;
  difficulty: LiveClassroomDifficulty;
  allowAiExplanations: boolean;
  allowStrategyCards: boolean;
  strategyCardPolicy: LiveClassroomStrategyCardPolicy;
  strategyCardLimitPerTeam: number;
  allowMusic: boolean;
  teamAssignment: LiveClassroomTeamAssignmentMode;
  captainMode: LiveClassroomCaptainMode;
  survivalHearts: number;
  enabledStrategyCards: LiveClassroomStrategyCardKind[];
  /** Reserved for voice / polls / screen share without schema churn. */
  futureExtensions?: Record<string, unknown>;
};

export type LiveClassroomReportStats = {
  attendance: number;
  accuracyPercent: number;
  averageResponseTimeSec: number;
  strongestTopic: string | null;
  weakestTopic: string | null;
  mostMissedQuestion: string | null;
  recommendations: string[];
  teamStats: Array<{
    teamName: string;
    score: number;
    accuracyPercent: number;
    avgResponseTimeSec: number;
  }>;
  individualStats: Array<{
    userId: string;
    displayName: string;
    correct: number;
    incorrect: number;
    accuracyPercent: number;
    avgResponseTimeSec: number;
  }>;
  questionAnalysis: Array<{
    questionId: string;
    prompt: string;
    correctCount: number;
    incorrectCount: number;
    accuracyPercent: number;
  }>;
  aiTeacherSummary: string;
  suggestedReviewMinutes: number;
};

export const DEFAULT_LIVE_CLASSROOM_SESSION_CONFIG: LiveClassroomSessionConfig = {
  questionCount: 5,
  timePerQuestionSec: 30,
  difficulty: "medium",
  allowAiExplanations: true,
  allowStrategyCards: true,
  strategyCardPolicy: "limited",
  strategyCardLimitPerTeam: 2,
  allowMusic: false,
  teamAssignment: "random",
  captainMode: "rotation",
  survivalHearts: 3,
  enabledStrategyCards: [
    "double_points",
    "extra_time",
    "fifty_fifty",
    "shield",
    "ai_hint",
    "score_boost",
    "recovery",
  ],
};

export const LIVE_CLASSROOM_DEFAULT_TEAM_NAMES = [
  "Blue Team",
  "Red Team",
  "Green Team",
  "Yellow Team",
] as const;

export function sessionTypeLabel(type: LiveClassroomSessionType): string {
  switch (type) {
    case "warm_up":
      return "Warm-Up Battle";
    case "team_battle":
      return "Team Battle";
    case "exit_ticket":
      return "Exit Ticket";
    case "review_battle":
      return "Review Battle";
    default:
      return type;
  }
}

export function battleModeLabel(mode: LiveClassroomBattleMode): string {
  switch (mode) {
    case "individual_team":
      return "Individual Team Battle";
    case "collaborative_team":
      return "Collaborative Team Battle";
    case "survival":
      return "Survival Battle";
    default:
      return mode;
  }
}

export function strategyCardLabel(kind: LiveClassroomStrategyCardKind): string {
  switch (kind) {
    case "double_points":
      return "Double Points";
    case "extra_time":
      return "Extra Time";
    case "fifty_fifty":
      return "50/50";
    case "shield":
      return "Shield";
    case "ai_hint":
      return "AI Hint";
    case "score_boost":
      return "Score Boost";
    case "recovery":
      return "Recovery";
    default:
      return kind;
  }
}
