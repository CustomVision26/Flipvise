import planDefaults from "@/data/ai-usage-plan-defaults.json";
import { canonicalTeamPlanId } from "@/lib/team-plans";
import { canonicalEducationPlanId } from "@/lib/education-plans";
import type {
  AiAllowance,
  AiUsagePeriodSnapshot,
  ResolvedAiLimit,
} from "@/lib/ai-usage/types";

const planAllowances = planDefaults.planAllowances as Record<
  string,
  number | null
>;

export function normalizePlanSlugForAllowance(
  plan: string | null | undefined,
): string | null {
  if (!plan) return null;
  const team = canonicalTeamPlanId(plan);
  if (team) return team;
  const edu = canonicalEducationPlanId(plan);
  if (edu) return edu;
  return plan;
}

export function planDefaultAllowance(
  plan: string | null | undefined,
): AiAllowance {
  const slug = normalizePlanSlugForAllowance(plan);
  if (!slug) {
    return { kind: "limited", generations: planDefaults.fallbackAllowance };
  }
  if (!(slug in planAllowances)) {
    return { kind: "limited", generations: planDefaults.fallbackAllowance };
  }
  const value = planAllowances[slug];
  if (value === null) return { kind: "unlimited" };
  return { kind: "limited", generations: value };
}

export function computeUsageStatus(params: {
  aiAccessEnabled: boolean;
  flagged: boolean;
  allowance: AiAllowance;
  usedGenerations: number;
}): AiUsagePeriodSnapshot["usageStatus"] {
  if (!params.aiAccessEnabled) return "disabled";
  if (params.flagged) return "flagged";
  if (params.allowance.kind === "unlimited") return "unlimited";
  const pct =
    params.allowance.generations <= 0
      ? 100
      : (params.usedGenerations / params.allowance.generations) * 100;
  if (pct >= 100) return "limit_reached";
  if (pct >= 90) return "critical";
  if (pct >= 80) return "approaching";
  return "normal";
}

export function buildPeriodSnapshot(params: {
  aiAccessEnabled: boolean;
  flagged: boolean;
  allowance: AiAllowance;
  usedGenerations: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostMicros: number;
}): AiUsagePeriodSnapshot {
  const { allowance, usedGenerations } = params;
  const remaining =
    allowance.kind === "unlimited"
      ? null
      : Math.max(0, allowance.generations - usedGenerations);
  const percentUsed =
    allowance.kind === "unlimited"
      ? null
      : allowance.generations <= 0
        ? 100
        : Math.min(
            999,
            Math.round((usedGenerations / allowance.generations) * 1000) / 10,
          );

  return {
    usedGenerations,
    remainingGenerations: remaining,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    totalTokens: params.totalTokens,
    estimatedCostMicros: params.estimatedCostMicros,
    percentUsed,
    usageStatus: computeUsageStatus(params),
  };
}

export function resolveAllowancePriority(params: {
  isPlatformAdmin: boolean;
  userUnlimited?: boolean | null;
  userMonthlyAllowance?: number | null;
  teamUnlimited?: boolean | null;
  teamMonthlyAllowance?: number | null;
  subscriptionPlan: string | null;
}): {
  allowance: AiAllowance;
  source: ResolvedAiLimit["source"];
} {
  if (params.isPlatformAdmin && planDefaults.platformAdminUnlimited) {
    return { allowance: { kind: "unlimited" }, source: "platform_admin" };
  }
  if (params.userUnlimited) {
    return { allowance: { kind: "unlimited" }, source: "user_override" };
  }
  if (
    typeof params.userMonthlyAllowance === "number" &&
    params.userMonthlyAllowance >= 0
  ) {
    return {
      allowance: { kind: "limited", generations: params.userMonthlyAllowance },
      source: "user_override",
    };
  }
  if (params.teamUnlimited) {
    return { allowance: { kind: "unlimited" }, source: "team_override" };
  }
  if (
    typeof params.teamMonthlyAllowance === "number" &&
    params.teamMonthlyAllowance >= 0
  ) {
    return {
      allowance: { kind: "limited", generations: params.teamMonthlyAllowance },
      source: "team_override",
    };
  }
  const planAllowance = planDefaultAllowance(params.subscriptionPlan);
  if (
    params.subscriptionPlan &&
    normalizePlanSlugForAllowance(params.subscriptionPlan) &&
    params.subscriptionPlan in planAllowances
  ) {
    return { allowance: planAllowance, source: "plan_default" };
  }
  if (params.subscriptionPlan) {
    return { allowance: planAllowance, source: "plan_default" };
  }
  return {
    allowance: { kind: "limited", generations: planDefaults.fallbackAllowance },
    source: "fallback",
  };
}

export function getPlanDefaultsConfig() {
  return planDefaults;
}
