import { isTeamPlanId, type TeamPlanId } from "@/lib/team-plans";

/**
 * Priority Support (Help Center tab + faster email SLA) is limited to:
 * - Pro Plus personal subscription
 * - Any active team-tier plan (Team Basic, Team Gold, Platinum, Enterprise)
 * - Platform administrators (complimentary access)
 *
 * Standard Pro does NOT include Priority Support.
 */
export function resolvePrioritySupportAccess(input: {
  isPlatformAdmin?: boolean;
  activeTeamPlan?: TeamPlanId | null;
  /** Resolved personal paid slug, e.g. `pro` or `pro_plus`. */
  personalPlanSlug?: string | null;
  /** Clerk JWT `has({ plan: "pro_plus" })`. */
  hasClerkProPlusPlan?: boolean;
}): boolean {
  if (input.isPlatformAdmin) return true;
  if (input.activeTeamPlan != null && isTeamPlanId(input.activeTeamPlan)) {
    return true;
  }
  if (input.hasClerkProPlusPlan) return true;
  if (input.personalPlanSlug === "pro_plus") return true;
  return false;
}
