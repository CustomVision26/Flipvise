import type { AdminUserPlanAccessType } from "@/lib/admin-user-plan-label";

/** True when personal access is a grant, not a Stripe subscription. */
export function isNonStripePersonalPlanGrant(
  type: AdminUserPlanAccessType,
): boolean {
  return (
    type === "Complimentary" ||
    type === "Assigned" ||
    type === "Affiliate"
  );
}

/** Deck editor / AI panel label for how card capacity is sourced. */
export function deckPlanCapacitySourceLabel(
  type: AdminUserPlanAccessType,
): string {
  if (type === "Free") return "Free plan";
  if (isNonStripePersonalPlanGrant(type)) return "Complimentary";
  return "Paid plan";
}
