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

/** Heartbeat is ~12s; treat presence stale after ~3 missed beats. */
export const LIVE_CLASSROOM_PRESENCE_STALE_MS = 36_000;

export function isLiveClassroomPresenceFresh(
  lastSeenAt: Date | string | null | undefined,
  nowMs: number = Date.now(),
  staleMs: number = LIVE_CLASSROOM_PRESENCE_STALE_MS,
): boolean {
  if (!lastSeenAt) return false;
  const seen =
    typeof lastSeenAt === "string"
      ? Date.parse(lastSeenAt)
      : lastSeenAt.getTime();
  if (Number.isNaN(seen)) return false;
  return nowMs - seen <= staleMs;
}

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

/** Countdown before battle after Start battle is pressed (60s … 5 min). */
export const LIVE_CLASSROOM_BATTLE_START_DELAY_OPTIONS_SEC = [
  60, 90, 120, 150, 180, 210, 240, 270, 300,
] as const;
export type LiveClassroomBattleStartDelaySec =
  (typeof LIVE_CLASSROOM_BATTLE_START_DELAY_OPTIONS_SEC)[number];

export function battleStartDelayLabel(sec: number): string {
  if (sec < 60) return `${sec} sec`;
  if (sec % 60 === 0) {
    const mins = sec / 60;
    return mins === 1 ? "1 min" : `${mins} min`;
  }
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${mins} min ${rem} sec`;
}

export type LiveClassroomSessionConfig = {
  questionCount: number;
  timePerQuestionSec: number;
  difficulty: LiveClassroomDifficulty;
  /**
   * Seconds to count down after Start battle before questions begin.
   * @default 60
   */
  battleStartDelaySec: number;
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
  battleStartDelaySec: 60,
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

/** Tailwind tone classes for lobby / projector / play team UI by `colorKey`. */
export function liveClassroomTeamTone(colorKey: string | null | undefined): {
  card: string;
  title: string;
  row: string;
  badgeOnline: string;
  badgeAway: string;
  /** Strong accent text (countdown team label, play headings). */
  accent: string;
  /** Soft border + fill for play/countdown surfaces. */
  surface: string;
  /** Selected answer / primary action fill. */
  choiceSelected: string;
  /** Idle choice outline hover. */
  choiceIdle: string;
  /** Timer / status chip. */
  chip: string;
} {
  switch ((colorKey ?? "blue").toLowerCase()) {
    case "red":
      return {
        card: "border-rose-500/45 bg-rose-500/[0.07]",
        title: "text-rose-200",
        row: "bg-rose-500/15 text-rose-50",
        badgeOnline:
          "border-transparent bg-rose-500/35 text-rose-50 hover:bg-rose-500/35",
        badgeAway: "border-rose-400/40 bg-transparent text-rose-200",
        accent: "text-rose-300",
        surface: "border-rose-500/50 bg-rose-950/40",
        choiceSelected:
          "border-rose-400 bg-rose-500/35 text-rose-50 hover:bg-rose-500/40",
        choiceIdle:
          "border-rose-500/35 bg-transparent text-foreground hover:bg-rose-500/10",
        chip: "border-rose-400/45 bg-rose-500/20 text-rose-100",
      };
    case "green":
      return {
        card: "border-emerald-500/45 bg-emerald-500/[0.07]",
        title: "text-emerald-200",
        row: "bg-emerald-500/15 text-emerald-50",
        badgeOnline:
          "border-transparent bg-emerald-500/35 text-emerald-50 hover:bg-emerald-500/35",
        badgeAway: "border-emerald-400/40 bg-transparent text-emerald-200",
        accent: "text-emerald-300",
        surface: "border-emerald-500/50 bg-emerald-950/40",
        choiceSelected:
          "border-emerald-400 bg-emerald-500/35 text-emerald-50 hover:bg-emerald-500/40",
        choiceIdle:
          "border-emerald-500/35 bg-transparent text-foreground hover:bg-emerald-500/10",
        chip: "border-emerald-400/45 bg-emerald-500/20 text-emerald-100",
      };
    case "yellow":
      return {
        card: "border-amber-500/45 bg-amber-500/[0.07]",
        title: "text-amber-200",
        row: "bg-amber-500/15 text-amber-50",
        badgeOnline:
          "border-transparent bg-amber-500/35 text-amber-50 hover:bg-amber-500/35",
        badgeAway: "border-amber-400/40 bg-transparent text-amber-200",
        accent: "text-amber-300",
        surface: "border-amber-500/50 bg-amber-950/40",
        choiceSelected:
          "border-amber-400 bg-amber-500/35 text-amber-50 hover:bg-amber-500/40",
        choiceIdle:
          "border-amber-500/35 bg-transparent text-foreground hover:bg-amber-500/10",
        chip: "border-amber-400/45 bg-amber-500/20 text-amber-100",
      };
    case "blue":
    default:
      return {
        card: "border-sky-500/45 bg-sky-500/[0.07]",
        title: "text-sky-200",
        row: "bg-sky-500/15 text-sky-50",
        badgeOnline:
          "border-transparent bg-sky-500/35 text-sky-50 hover:bg-sky-500/35",
        badgeAway: "border-sky-400/40 bg-transparent text-sky-200",
        accent: "text-sky-300",
        surface: "border-sky-500/50 bg-sky-950/40",
        choiceSelected:
          "border-sky-400 bg-sky-500/35 text-sky-50 hover:bg-sky-500/40",
        choiceIdle:
          "border-sky-500/35 bg-transparent text-foreground hover:bg-sky-500/10",
        chip: "border-sky-400/45 bg-sky-500/20 text-sky-100",
      };
  }
}
