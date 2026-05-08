import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";

/**
 * Resolves a single line for the admin users table "Plan" column, in order:
 * admin role (super/co-admin) → subscribed product (`publicMetadata.plan` or
 * `teamPlanId`) → `adminGranted` → active Stripe with no plan slug → Free.
 *
 * Superadmin/co-admin are roles; both include Pro Plus–level gated features automatically (e.g. listen-to-card).
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
    return "Pro Plus";
  }

  const p = planMeta?.trim();
  if (p) {
    return displayNameForBillingPlanSlug(p);
  }

  if (adminGranted) {
    return "Complimentary Pro";
  }

  if (stripeSubscriptionActive) {
    return "Pro (active subscription)";
  }

  return "Free";
}
