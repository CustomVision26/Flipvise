import { PRO_PLUS_PERSONAL_DECK_LIMIT } from "@/lib/personal-plan-limits";
import { isTeamPlanId, type TeamPlanId } from "@/lib/team-plans";

/** Education subscription plan slugs — separate from consumer team tiers. */
export const EDUCATION_PLAN_IDS = [
  "education_plus",
  "education_gold",
  "education_enterprise",
] as const;

export type EducationPlanId = (typeof EDUCATION_PLAN_IDS)[number];

/** Education plans with team workspace features (parallel to Team Gold / Enterprise). */
export const EDUCATION_TEAM_PLAN_IDS = [
  "education_gold",
  "education_enterprise",
] as const;

export type EducationTeamPlanId = (typeof EDUCATION_TEAM_PLAN_IDS)[number];

/** Team or education team tier used when creating a new workspace. */
export type WorkspaceCreatePlanId = TeamPlanId | EducationTeamPlanId;

export const EDUCATION_PLAN_LABELS: Record<EducationPlanId, string> = {
  education_plus: "Education Plus",
  education_gold: "Education Gold",
  education_enterprise: "Education Enterprise",
};

export const EDUCATION_PLAN_BADGES: Record<EducationPlanId, string> = {
  education_plus: "For Teachers",
  education_gold: "For Teaching Teams",
  education_enterprise: "For Schools",
};

export const EDUCATION_TEAM_LIMITS: Record<
  EducationTeamPlanId,
  { maxTeams: number; maxMembersPerTeam: number; maxDecksPerWorkspace: number }
> = {
  education_gold: {
    maxTeams: 10,
    maxMembersPerTeam: 25,
    maxDecksPerWorkspace: PRO_PLUS_PERSONAL_DECK_LIMIT,
  },
  education_enterprise: {
    maxTeams: 30,
    maxMembersPerTeam: 45,
    maxDecksPerWorkspace: PRO_PLUS_PERSONAL_DECK_LIMIT,
  },
};

export function canonicalEducationPlanId(
  slug: string,
): EducationPlanId | null {
  if ((EDUCATION_PLAN_IDS as readonly string[]).includes(slug)) {
    return slug as EducationPlanId;
  }
  return null;
}

export function isEducationPlanId(slug: string): slug is EducationPlanId {
  return canonicalEducationPlanId(slug) !== null;
}

export function isEducationTeamPlanId(
  slug: string,
): slug is EducationTeamPlanId {
  return (EDUCATION_TEAM_PLAN_IDS as readonly string[]).includes(slug);
}

export function hasEducationPlan(
  plan: string | null | undefined,
): boolean {
  if (!plan) return false;
  return isEducationPlanId(plan.trim());
}

export function canAccessTeacherTools(
  plan: string | null | undefined,
): boolean {
  return hasEducationPlan(plan);
}

export function hasProPlusFeatures(
  plan: string | null | undefined,
): boolean {
  if (!plan) return false;
  const p = plan.trim();
  return (
    p === "pro_plus" ||
    p === "education_plus" ||
    p === "pro_plus_team_basic" ||
    p === "pro_plus_team_gold" ||
    p === "education_gold" ||
    p === "pro_plus_platinum_plan" ||
    p === "pro_plus_enterprise" ||
    p === "education_enterprise"
  );
}

/**
 * Personal deck quiz format configuration from Study → Quiz
 * (Format Quiz Question dialog). Pro Plus and Education Plus only —
 * not Education Gold/Enterprise (those use Team Admin Study Privileges).
 */
export function canConfigurePersonalDeckQuizFormats(
  plan: string | null | undefined,
): boolean {
  if (!plan) return false;
  const p = plan.trim();
  return p === "pro_plus" || p === "education_plus";
}

export function hasTeamGoldFeatures(
  plan: string | null | undefined,
): boolean {
  if (!plan) return false;
  const p = plan.trim();
  return (
    p === "pro_plus_team_gold" ||
    p === "education_gold" ||
    p === "pro_plus_platinum_plan" ||
    p === "pro_plus_enterprise" ||
    p === "education_enterprise"
  );
}

export function hasEnterpriseFeatures(
  plan: string | null | undefined,
): boolean {
  if (!plan) return false;
  const p = plan.trim();
  return p === "pro_plus_enterprise" || p === "education_enterprise";
}

export function resolveActiveEducationTeamPlanFromHas(
  has:
    | ((a: { plan: string } | { feature: string }) => boolean | undefined)
    | undefined,
): EducationTeamPlanId | null {
  if (!has) return null;
  for (const plan of EDUCATION_TEAM_PLAN_IDS) {
    if (has({ plan })) return plan;
  }
  return null;
}

export function limitsForEducationTeamPlan(planSlug: string) {
  const canonical = canonicalEducationPlanId(planSlug);
  if (canonical && isEducationTeamPlanId(canonical)) {
    return EDUCATION_TEAM_LIMITS[canonical];
  }
  return { maxTeams: 0, maxMembersPerTeam: 0, maxDecksPerWorkspace: 0 };
}

/** True for consumer team tiers and education team tiers (workspace subscription plans). */
export function isWorkspaceSubscriptionPlanSlug(
  slug: string,
): slug is WorkspaceCreatePlanId {
  return isTeamPlanId(slug) || isEducationTeamPlanId(slug);
}

export function labelForEducationPlanSlug(slug: string): string | undefined {
  const canonical = canonicalEducationPlanId(slug);
  return canonical ? EDUCATION_PLAN_LABELS[canonical] : undefined;
}
