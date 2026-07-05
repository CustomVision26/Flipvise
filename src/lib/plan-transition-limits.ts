import {
  FREE_CARDS_PER_DECK_LIMIT,
  FREE_PERSONAL_DECK_LIMIT,
  limitsForPersonalIndividualTier,
} from "@/lib/personal-plan-limits";
import {
  EDUCATION_PLAN_LABELS,
  isEducationTeamPlanId,
  isWorkspaceSubscriptionPlanSlug,
} from "@/lib/education-plans";
import { limitsForPlan, TEAM_PLAN_LABELS, canonicalTeamPlanId } from "@/lib/team-plans";
import type { PlanReconciliationLimits, PlanReconciliationMode } from "@/lib/plan-reconciliation-types";

function labelForPlanSlug(planSlug: string): string {
  const canonicalTeam = canonicalTeamPlanId(planSlug);
  if (canonicalTeam) return TEAM_PLAN_LABELS[canonicalTeam];
  const educationLabel = EDUCATION_PLAN_LABELS[planSlug as keyof typeof EDUCATION_PLAN_LABELS];
  if (educationLabel) return educationLabel;
  if (planSlug === "pro") return "Pro";
  if (planSlug === "pro_plus") return "Pro Plus";
  return planSlug;
}

export function reconciliationModeForPlan(planSlug: string | null): PlanReconciliationMode {
  if (!planSlug) return "personal";
  if (isWorkspaceSubscriptionPlanSlug(planSlug)) return "team";
  return "personal";
}

export function limitsForReconciliationPlan(planSlug: string | null): PlanReconciliationLimits {
  const mode = reconciliationModeForPlan(planSlug);
  if (!planSlug || planSlug === "free") {
    return {
      mode: "personal",
      planLabel: "Free",
      maxTeams: null,
      maxMembersPerTeam: null,
      maxDecksPerWorkspace: null,
      maxPersonalDecks: FREE_PERSONAL_DECK_LIMIT,
    };
  }

  if (mode === "team") {
    const limits = limitsForPlan(planSlug);
    return {
      mode: "team",
      planLabel: labelForPlanSlug(planSlug),
      maxTeams: limits.maxTeams,
      maxMembersPerTeam: limits.maxMembersPerTeam,
      maxDecksPerWorkspace: limits.maxDecksPerWorkspace,
      maxPersonalDecks: null,
    };
  }

  const tier =
    planSlug === "pro"
      ? "pro"
      : "pro_plus";
  const personal = limitsForPersonalIndividualTier(tier);
  return {
    mode: "personal",
    planLabel: labelForPlanSlug(planSlug),
    maxTeams: null,
    maxMembersPerTeam: null,
    maxDecksPerWorkspace: null,
    maxPersonalDecks: personal.maxPersonalDecks,
  };
}

export function planTransitionTriggerKind(
  previousPlanSlug: string | null,
  targetPlanSlug: string | null,
): "upgrade" | "downgrade" | "lateral" {
  const prev = limitsCapacityScore(previousPlanSlug);
  const next = limitsCapacityScore(targetPlanSlug);
  if (next > prev) return "upgrade";
  if (next < prev) return "downgrade";
  return "lateral";
}

function limitsCapacityScore(planSlug: string | null): number {
  if (!planSlug) return 0;
  if (isWorkspaceSubscriptionPlanSlug(planSlug)) {
    const limits = limitsForPlan(planSlug);
    return (
      limits.maxTeams * 1000 +
      limits.maxMembersPerTeam * 10 +
      limits.maxDecksPerWorkspace
    );
  }
  const limits = limitsForReconciliationPlan(planSlug);
  return (limits.maxPersonalDecks ?? FREE_PERSONAL_DECK_LIMIT) * 5;
}

export function freeTierCardLimit(): number {
  return FREE_CARDS_PER_DECK_LIMIT;
}

export function isLeavingEducationTeamPlan(
  previousPlanSlug: string | null,
  targetPlanSlug: string | null,
): boolean {
  return (
    previousPlanSlug != null &&
    isEducationTeamPlanId(previousPlanSlug) &&
    (targetPlanSlug == null || !isEducationTeamPlanId(targetPlanSlug))
  );
}
