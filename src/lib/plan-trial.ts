import type { PlanConfig, PlanTrialConfig } from "@/lib/plan-config-types";
import type { StripePaidPlanId } from "@/lib/billing-plan-ids";
import { isStripePaidPlanId } from "@/lib/billing-plan-ids";

export const DEFAULT_TRIAL_DAYS = 7;

export function normalizePlanTrialConfig(
  trial: PlanTrialConfig | undefined,
): PlanTrialConfig {
  const days = Math.max(0, Math.min(90, Math.floor(trial?.days ?? 0)));
  return {
    days,
    published: Boolean(trial?.published) && days > 0,
  };
}

export function isPublishedPlanTrial(plan: PlanConfig): boolean {
  const trial = normalizePlanTrialConfig(plan.trial);
  return trial.published && plan.id !== "free";
}

export function publishedTrialDaysForPlan(plan: PlanConfig): number {
  if (!isPublishedPlanTrial(plan)) return 0;
  return normalizePlanTrialConfig(plan.trial).days;
}

export function canUserStartPlanTrial(input: {
  plan: PlanConfig;
  hasUsedTrial: boolean;
  hasActiveSubscription: boolean;
}): boolean {
  if (input.hasUsedTrial || input.hasActiveSubscription) return false;
  return isPublishedPlanTrial(input.plan);
}

export function resolveCheckoutTrialDays(input: {
  plan: PlanConfig;
  planId: StripePaidPlanId;
  startTrial: boolean;
  hasUsedTrial: boolean;
  period: "monthly" | "yearly";
}): number | null {
  if (!input.startTrial || input.hasUsedTrial || input.period !== "monthly") {
    return null;
  }
  if (!isStripePaidPlanId(input.planId)) return null;
  const days = publishedTrialDaysForPlan(input.plan);
  return days > 0 ? days : null;
}
