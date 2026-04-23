import { TEAM_PLAN_LABELS, isTeamPlanId, type TeamPlanId } from "@/lib/team-plans";

/**
 * Resolves a single line for the admin users table "Plan" column, in order:
 * platform super → co → subscribed product (`publicMetadata.plan` or `teamPlanId`) →
 * `adminGranted` → active Stripe with no plan slug → Free.
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

  if (isSuperadmin) {
    return "Platform superadmin";
  }
  if (isCoAdmin) {
    return "Platform co-admin";
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
