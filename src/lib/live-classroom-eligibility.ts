import { isEducationTeamPlanId } from "@/lib/education-plans";
import { isTeamPlanId, limitsForPlan } from "@/lib/team-plans";

/**
 * Plans that may purchase or receive the Live Classroom™ organization add-on.
 * Individual Free / Pro / Pro Plus / Education Plus are intentionally excluded.
 */
export const LIVE_CLASSROOM_ELIGIBLE_PLAN_IDS = [
  "pro_plus_team_basic",
  "pro_plus_team_gold",
  "pro_plus_platinum_plan",
  "pro_plus_enterprise",
  "education_gold",
  "education_enterprise",
] as const;

export type LiveClassroomEligiblePlanId =
  (typeof LIVE_CLASSROOM_ELIGIBLE_PLAN_IDS)[number];

export function isLiveClassroomEligiblePlanSlug(
  planSlug: string | null | undefined,
): planSlug is LiveClassroomEligiblePlanId {
  if (!planSlug) return false;
  return (LIVE_CLASSROOM_ELIGIBLE_PLAN_IDS as readonly string[]).includes(
    planSlug,
  );
}

/** True for any workspace subscription plan that can host Live Classroom. */
export function isLiveClassroomWorkspacePlan(
  planSlug: string | null | undefined,
): boolean {
  if (!planSlug) return false;
  return isTeamPlanId(planSlug) || isEducationTeamPlanId(planSlug);
}

/**
 * Max Live Classroom participants — always inherits organization licensed seats.
 * Never duplicate a separate seat package.
 */
export function liveClassroomParticipantLimitForPlan(
  planSlug: string,
): number {
  if (!isLiveClassroomEligiblePlanSlug(planSlug) && !isLiveClassroomWorkspacePlan(planSlug)) {
    return 0;
  }
  return limitsForPlan(planSlug).maxMembersPerTeam;
}

/** Enterprise tiers may raise concurrent-session caps in org settings. */
export function liveClassroomAllowsConcurrentOverride(
  planSlug: string,
): boolean {
  return (
    planSlug === "pro_plus_enterprise" || planSlug === "education_enterprise"
  );
}

export function defaultMaxConcurrentLiveSessions(planSlug: string): number {
  return liveClassroomAllowsConcurrentOverride(planSlug) ? 3 : 1;
}
