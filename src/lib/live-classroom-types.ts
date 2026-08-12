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

/**
 * `exit_ticket` / `review_battle` are legacy values kept only so historical
 * sessions still load and display correctly — they are no longer offered as
 * create/edit options (see `sessionTypeLabel` / DB enum for back-compat).
 */
export const LIVE_CLASSROOM_SESSION_TYPES = [
  "warm_up",
  "team_battle",
  "head_to_head",
] as const;
export type LiveClassroomSessionType =
  | (typeof LIVE_CLASSROOM_SESSION_TYPES)[number]
  | "exit_ticket"
  | "review_battle";
/** The subset of session types offered when creating/editing a session. */
export type LiveClassroomCreatableSessionType =
  (typeof LIVE_CLASSROOM_SESSION_TYPES)[number];

/** Maps any legacy session type to a valid creatable one (fallback: Warm-Up). */
export function normalizeCreatableSessionType(
  type: LiveClassroomSessionType,
): LiveClassroomCreatableSessionType {
  return (LIVE_CLASSROOM_SESSION_TYPES as readonly string[]).includes(type)
    ? (type as LiveClassroomCreatableSessionType)
    : "warm_up";
}

export const LIVE_CLASSROOM_BATTLE_MODES = [
  "individual_team",
  "collaborative_team",
  "survival",
] as const;
export type LiveClassroomBattleMode =
  (typeof LIVE_CLASSROOM_BATTLE_MODES)[number];

/**
 * Which battle modes a given session type may run. Warm-Up stays flexible
 * (any mode); Team Battle is team-based only; Head To Head is Survival's
 * every-player-for-themselves ranking only. Legacy types are unrestricted so
 * pre-existing sessions keep working.
 */
export function battleModesForSessionType(
  type: LiveClassroomSessionType,
): readonly LiveClassroomBattleMode[] {
  switch (type) {
    case "warm_up":
      return LIVE_CLASSROOM_BATTLE_MODES;
    case "team_battle":
      return ["individual_team", "collaborative_team"];
    case "head_to_head":
      return ["survival"];
    default:
      return LIVE_CLASSROOM_BATTLE_MODES;
  }
}

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

/** Who a strategy card applies to once activated. */
export const LIVE_CLASSROOM_STRATEGY_CARD_SCOPES = [
  "all",
  "individual",
  "disabled",
] as const;
export type LiveClassroomStrategyCardScope =
  (typeof LIVE_CLASSROOM_STRATEGY_CARD_SCOPES)[number];

/** Extra time granted per activation must fall within 30 sec – 5 min. */
export const LIVE_CLASSROOM_EXTRA_TIME_MIN_SEC = 30;
export const LIVE_CLASSROOM_EXTRA_TIME_MAX_SEC = 300;

/** Per-kind configuration: scope, linked deck cards, score/time value, and usage cap. */
export type LiveClassroomStrategyCardSetting = {
  scope: LiveClassroomStrategyCardScope;
  /** Deck card ids this card applies to when `scope === "individual"`. */
  cardIds: number[];
  /** Score awarded on use — only meaningful for double_points / score_boost. */
  value: number;
  /** Extra seconds granted on use — only meaningful for extra_time (30–300). */
  seconds: number;
  /** How many times a single team may activate this card kind in one battle. */
  maxActivationsPerTeam: number;
};

export type LiveClassroomStrategyCardSettings = Partial<
  Record<LiveClassroomStrategyCardKind, LiveClassroomStrategyCardSetting>
>;

export const LIVE_CLASSROOM_DIFFICULTIES = [
  "easy",
  "medium",
  "hard",
] as const;
export type LiveClassroomDifficulty =
  (typeof LIVE_CLASSROOM_DIFFICULTIES)[number];

/** Which deck cards become battle questions: every card, or a host-picked subset. */
export const LIVE_CLASSROOM_QUESTION_SOURCE_MODES = ["all", "specific"] as const;
export type LiveClassroomQuestionSourceMode =
  (typeof LIVE_CLASSROOM_QUESTION_SOURCE_MODES)[number];

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

/** Per-question timer: disabled (no time limit) or 30 sec – 5 min. */
export const LIVE_CLASSROOM_TIME_PER_QUESTION_OPTIONS_SEC = [
  30, 45, 60, 90, 120, 150, 180, 210, 240, 270, 300,
] as const;

/** `null` means the battle has no per-question time limit. */
export function timePerQuestionLabel(sec: number | null | undefined): string {
  if (sec == null) return "No time limit";
  return battleStartDelayLabel(sec);
}

/**
 * Manual abandonment-window choices (1 min – 1 hr). `null` keeps the
 * automatic default: 3 min for timed battles, 30 min for untimed battles.
 */
export const LIVE_CLASSROOM_ABANDONMENT_WINDOW_OPTIONS_SEC = [
  60, 120, 180, 300, 600, 900, 1800, 3600,
] as const;

/** `null` means "Auto" (timer-aware default handled server-side). */
export function abandonmentWindowLabel(sec: number | null | undefined): string {
  if (sec == null) return "Auto (recommended)";
  if (sec >= 3600 && sec % 3600 === 0) {
    const hrs = sec / 3600;
    return hrs === 1 ? "1 hr" : `${hrs} hr`;
  }
  return battleStartDelayLabel(sec);
}

export type LiveClassroomSessionConfig = {
  questionCount: number;
  /** Whether questions were built from every deck card or a host-picked subset. */
  questionSourceMode: LiveClassroomQuestionSourceMode;
  /** Deck card ids used when `questionSourceMode === "specific"`. */
  selectedDeckCardIds: number[];
  /** Seconds allowed per question, or `null` for no time limit (untimed battle). */
  timePerQuestionSec: number | null;
  /**
   * Base points awarded for a correct answer on each battle question
   * (before speed/participation bonuses and strategy-card bonuses).
   */
  pointsPerQuestion: number;
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
  /** Per-kind scope, deck-card targeting, score/time value, and activation cap. */
  strategyCardSettings?: LiveClassroomStrategyCardSettings;
  /**
   * Manual override for how long a silent player is given before an
   * independent/survival battle is treated as abandoned and auto-completed.
   * `null` = Auto (3 min timed / 30 min untimed). Owner/team admin only.
   */
  abandonmentWindowSec?: number | null;
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
    /** `null` when the participant was never assigned to a team. */
    teamName: string | null;
    correct: number;
    incorrect: number;
    accuracyPercent: number;
    avgResponseTimeSec: number;
    /**
     * Total points scored — used to rank the Survival (every-player-for-themselves)
     * winner. Optional for backward compatibility with reports written before this field existed.
     */
    score?: number;
  }>;
  questionAnalysis: Array<{
    questionId: string;
    prompt: string;
    correctCount: number;
    incorrectCount: number;
    accuracyPercent: number;
    /** Strategy cards activated on this question, by team. */
    strategyCardsUsed: Array<{
      kind: LiveClassroomStrategyCardKind;
      teamName: string;
    }>;
    /** Total extra seconds granted by the host/team admin on this question. */
    extraTimeAddedSec: number;
    /** Whether the host revealed the correct answer for this question. */
    revealed: boolean;
  }>;
  aiTeacherSummary: string;
  suggestedReviewMinutes: number;
};

export const DEFAULT_LIVE_CLASSROOM_SESSION_CONFIG: LiveClassroomSessionConfig = {
  questionCount: 5,
  questionSourceMode: "all",
  selectedDeckCardIds: [],
  timePerQuestionSec: 30,
  pointsPerQuestion: 100,
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
  strategyCardSettings: {},
  abandonmentWindowSec: null,
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
    case "head_to_head":
      return "Head To Head Battle";
    // Legacy — no longer offered as a create/edit option, kept for display.
    case "exit_ticket":
      return "Exit Ticket";
    case "review_battle":
      return "Review Battle";
    default:
      return type;
  }
}

/** Short one-liner shown under each Session type option — explains which battle modes it unlocks. */
export function sessionTypeDescription(type: LiveClassroomSessionType): string {
  switch (type) {
    case "warm_up":
      return "Any battle mode — Individual, Collaborative, or Survival.";
    case "team_battle":
      return "Team-based only — Individual Team or Collaborative Team.";
    case "head_to_head":
      return "Every player for themselves — Survival mode only.";
    default:
      return "";
  }
}

export function battleModeLabel(mode: LiveClassroomBattleMode): string {
  switch (mode) {
    case "individual_team":
      return "Individual Team";
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

/** Individual / Collaborative: no Shield or Recovery (survival-only). */
const STRATEGY_CARDS_STANDARD: LiveClassroomStrategyCardKind[] = [
  "double_points",
  "extra_time",
  "fifty_fifty",
  "ai_hint",
  "score_boost",
];

/** Survival includes Shield + Recovery. */
const STRATEGY_CARDS_SURVIVAL: LiveClassroomStrategyCardKind[] = [
  "double_points",
  "extra_time",
  "fifty_fifty",
  "ai_hint",
  "shield",
  "recovery",
  "score_boost",
];

/** Strategy card kinds allowed for a battle mode. */
export function strategyCardsForBattleMode(
  mode: LiveClassroomBattleMode,
): LiveClassroomStrategyCardKind[] {
  return mode === "survival"
    ? [...STRATEGY_CARDS_SURVIVAL]
    : [...STRATEGY_CARDS_STANDARD];
}

/**
 * Extra Time only makes sense when the battle has a per-question time limit.
 * Filters a kind list down when `timePerQuestionSec` is `null` (untimed).
 */
export function strategyCardsForTimerState<
  T extends readonly LiveClassroomStrategyCardKind[],
>(kinds: T, timePerQuestionSec: number | null | undefined): LiveClassroomStrategyCardKind[] {
  return timePerQuestionSec == null
    ? kinds.filter((k) => k !== "extra_time")
    : [...kinds];
}

/**
 * unlimited = every mode-allowed card enabled;
 * limited = some but not all;
 * disabled = none enabled.
 */
export function deriveStrategyCardPolicy(
  enabled: readonly LiveClassroomStrategyCardKind[],
  available: readonly LiveClassroomStrategyCardKind[],
): LiveClassroomStrategyCardPolicy {
  const enabledInMode = enabled.filter((k) => available.includes(k));
  if (enabledInMode.length === 0) return "disabled";
  if (available.every((k) => enabledInMode.includes(k))) return "unlimited";
  return "limited";
}

/** Default / clamp bounds for host-configured points per correct question. */
export const LIVE_CLASSROOM_POINTS_PER_QUESTION_DEFAULT = 100;
export const LIVE_CLASSROOM_POINTS_PER_QUESTION_MIN = 1;
export const LIVE_CLASSROOM_POINTS_PER_QUESTION_MAX = 10_000;

/** Double Points card default award = 2× the battle's points-per-question. */
export function doublePointsDefaultAward(pointsPerQuestion: number): number {
  const base = Number.isFinite(pointsPerQuestion)
    ? Math.round(pointsPerQuestion)
    : LIVE_CLASSROOM_POINTS_PER_QUESTION_DEFAULT;
  return Math.max(0, base * 2);
}

export function clampPointsPerQuestion(value: number): number {
  if (!Number.isFinite(value)) return LIVE_CLASSROOM_POINTS_PER_QUESTION_DEFAULT;
  return Math.min(
    LIVE_CLASSROOM_POINTS_PER_QUESTION_MAX,
    Math.max(LIVE_CLASSROOM_POINTS_PER_QUESTION_MIN, Math.round(value)),
  );
}

/** Default per-kind setting used until the host configures the card. */
export function defaultStrategyCardSetting(
  kind: LiveClassroomStrategyCardKind,
  options?: { pointsPerQuestion?: number },
): LiveClassroomStrategyCardSetting {
  const points =
    options?.pointsPerQuestion ?? LIVE_CLASSROOM_POINTS_PER_QUESTION_DEFAULT;
  switch (kind) {
    case "double_points":
      return {
        scope: "all",
        cardIds: [],
        value: doublePointsDefaultAward(points),
        seconds: 0,
        maxActivationsPerTeam: 1,
      };
    case "score_boost":
      return { scope: "all", cardIds: [], value: 50, seconds: 0, maxActivationsPerTeam: 1 };
    case "extra_time":
      return { scope: "all", cardIds: [], value: 0, seconds: 30, maxActivationsPerTeam: 1 };
    default:
      return { scope: "all", cardIds: [], value: 0, seconds: 0, maxActivationsPerTeam: 1 };
  }
}

/** Resolve a kind's setting, falling back to sensible defaults. */
export function resolveStrategyCardSetting(
  settings: LiveClassroomStrategyCardSettings | null | undefined,
  kind: LiveClassroomStrategyCardKind,
  options?: { pointsPerQuestion?: number },
): LiveClassroomStrategyCardSetting {
  const stored = settings?.[kind];
  const fallback = defaultStrategyCardSetting(kind, options);
  if (!stored) return fallback;
  return {
    scope: stored.scope ?? fallback.scope,
    cardIds: Array.isArray(stored.cardIds) ? stored.cardIds : fallback.cardIds,
    value: Number.isFinite(stored.value) ? stored.value : fallback.value,
    seconds: Number.isFinite(stored.seconds) ? stored.seconds : fallback.seconds,
    maxActivationsPerTeam: Number.isFinite(stored.maxActivationsPerTeam)
      ? Math.max(1, stored.maxActivationsPerTeam)
      : fallback.maxActivationsPerTeam,
  };
}

/**
 * Kinds a team may receive cards for — a kind is "enabled" whenever its
 * resolved scope is not "disabled". Mirrors the policy chip shown in the UI.
 */
export function strategyCardEnabledKinds(
  settings: LiveClassroomStrategyCardSettings | null | undefined,
  available: readonly LiveClassroomStrategyCardKind[],
): LiveClassroomStrategyCardKind[] {
  return available.filter(
    (k) => resolveStrategyCardSetting(settings, k).scope !== "disabled",
  );
}

export function strategyCardScopeLabel(
  scope: LiveClassroomStrategyCardScope,
): string {
  switch (scope) {
    case "all":
      return "All cards in battle";
    case "individual":
      return "Individual cards/questions";
    case "disabled":
      return "Disabled";
    default:
      return scope;
  }
}

/** Whether a kind's activation grants a configurable score bonus. */
export function strategyCardHasScoreValue(
  kind: LiveClassroomStrategyCardKind,
): boolean {
  return kind === "double_points" || kind === "score_boost";
}

/** Whether a card instance (by originating deck card id) is eligible under a setting. */
export function strategyCardAppliesToDeckCard(
  setting: LiveClassroomStrategyCardSetting,
  deckCardId: number | null | undefined,
): boolean {
  if (setting.scope === "disabled") return false;
  if (setting.scope === "all") return true;
  return deckCardId != null && setting.cardIds.includes(deckCardId);
}

export type LiveClassroomStrategyCardSettingInput = {
  scope: LiveClassroomStrategyCardScope;
  cardIds?: number[];
  value?: number;
  seconds?: number;
  maxActivationsPerTeam?: number;
};

/** Clamp a single host-submitted setting into a safe, fully-populated shape. */
export function normalizeStrategyCardSetting(
  kind: LiveClassroomStrategyCardKind,
  entry: LiveClassroomStrategyCardSettingInput,
  options?: { pointsPerQuestion?: number },
): LiveClassroomStrategyCardSetting {
  const fallback = defaultStrategyCardSetting(kind, options);
  return {
    scope: entry.scope,
    cardIds: Array.isArray(entry.cardIds) ? entry.cardIds : fallback.cardIds,
    value: Math.max(0, Math.round(entry.value ?? fallback.value)),
    seconds:
      kind === "extra_time"
        ? Math.min(
            LIVE_CLASSROOM_EXTRA_TIME_MAX_SEC,
            Math.max(
              LIVE_CLASSROOM_EXTRA_TIME_MIN_SEC,
              Math.round(entry.seconds ?? fallback.seconds),
            ),
          )
        : Math.max(0, Math.round(entry.seconds ?? fallback.seconds)),
    maxActivationsPerTeam: Math.max(
      1,
      Math.min(20, Math.round(entry.maxActivationsPerTeam ?? fallback.maxActivationsPerTeam)),
    ),
  };
}

/** Normalize a full (possibly partial) host-submitted settings map. */
export function normalizeStrategyCardSettings(
  input:
    | Partial<Record<LiveClassroomStrategyCardKind, LiveClassroomStrategyCardSettingInput>>
    | null
    | undefined,
  options?: { pointsPerQuestion?: number },
): LiveClassroomStrategyCardSettings {
  const out: LiveClassroomStrategyCardSettings = {};
  if (!input) return out;
  for (const kind of LIVE_CLASSROOM_STRATEGY_CARD_KINDS) {
    const entry = input[kind];
    if (!entry) continue;
    out[kind] = normalizeStrategyCardSetting(kind, entry, options);
  }
  return out;
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
        surface: "border-rose-500/60 bg-rose-950/70",
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
        surface: "border-emerald-500/60 bg-emerald-950/70",
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
        surface: "border-amber-500/60 bg-amber-950/65",
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
        surface: "border-sky-500/60 bg-sky-950/70",
        choiceSelected:
          "border-sky-400 bg-sky-500/35 text-sky-50 hover:bg-sky-500/40",
        choiceIdle:
          "border-sky-500/35 bg-transparent text-foreground hover:bg-sky-500/10",
        chip: "border-sky-400/45 bg-sky-500/20 text-sky-100",
      };
  }
}
