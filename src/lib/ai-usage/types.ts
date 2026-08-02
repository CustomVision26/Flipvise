export const AI_USAGE_FEATURES = [
  "flashcards",
  "quiz",
  "lesson_plan",
  "essay",
  "study_guide",
  "passage",
  "ai_recall",
  "homework",
  "worksheet",
  "documentation",
  "tts",
  "ocr",
  "curriculum_research",
  "image_generation",
  "live_classroom",
  "other",
] as const;

export type AiUsageFeature = (typeof AI_USAGE_FEATURES)[number];

export const AI_USAGE_STATUSES = [
  "success",
  "failed",
  "blocked",
  "timed_out",
] as const;

export type AiUsageStatus = (typeof AI_USAGE_STATUSES)[number];

export type AiTokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  totalTokens: number;
};

export type AiAllowance =
  | { kind: "limited"; generations: number }
  | { kind: "unlimited" };

export type ResolvedAiLimit = {
  allowance: AiAllowance;
  source: "user_override" | "team_override" | "plan_default" | "fallback" | "platform_admin";
  aiAccessEnabled: boolean;
  blockAtLimit: boolean;
  allowOverage: boolean;
  subscriptionPlan: string | null;
  teamId: number | null;
  periodStart: Date;
  periodEnd: Date;
  flagged: boolean;
  flagReason: string | null;
};

export type AiUsagePeriodSnapshot = {
  usedGenerations: number;
  remainingGenerations: number | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostMicros: number;
  percentUsed: number | null;
  usageStatus:
    | "normal"
    | "approaching"
    | "critical"
    | "limit_reached"
    | "disabled"
    | "flagged"
    | "unlimited";
};

export type AiDatePreset =
  | "today"
  | "last_7_days"
  | "last_30_days"
  | "current_billing_period"
  | "current_month"
  | "custom";
