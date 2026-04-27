import { TEAM_PLAN_LABELS, isTeamPlanId, type TeamPlanId } from "@/lib/team-plans";

/**
 * Resolves a single line for the admin users table "Plan" column, in order:
 * admin role (super/co-admin) → subscribed product (`publicMetadata.plan` or
 * `teamPlanId`) → `adminGranted` → active Stripe with no plan slug → Free.
 *
 * Superadmin/co-admin are roles, but both include Pro access automatically.
 */
export function getAdminUserPlanColumnLabel(input: {
  isSuperadmin: boolean;
  isCoAdmin: boolean;
  adminGranted: boolean;
  /** Clerk `publicMetadata.plan` or, for team billing, `publicMetadata.teamPlanId`. */
  planMeta: string | undefined;
  stripeSubscriptionActive: boolean;
}): string {
  const { isSuperadmin, isCoAdmin, adminGranted, planMeta, stripeSubscriptionActive } =
    input;
  if (isSuperadmin || isCoAdmin) {
    return "Pro";
  }

  const p = planMeta?.trim();
  if (p) {
    if (p === "pro") {
      return "Pro";
    }
    if (isTeamPlanId(p)) {
      return TEAM_PLAN_LABELS[p as TeamPlanId];
    }
    return p;
  }

  if (adminGranted) {
    return "Complimentary Pro";
  }

  if (stripeSubscriptionActive) {
    return "Pro (active subscription)";
  }

  return "Free";
}
