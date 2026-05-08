import { TEAM_PLAN_IDS, type TeamPlanId } from "@/lib/team-plans";

/** Individual paid plans billed through Stripe (personal workspace). */
export const PERSONAL_STRIPE_PLAN_IDS = ["pro", "pro_plus"] as const;
export type PersonalStripePlanId = (typeof PERSONAL_STRIPE_PLAN_IDS)[number];

/** Every plan slug that maps to a Stripe subscription price env var. */
export const STRIPE_PAID_PLAN_IDS = [
  ...PERSONAL_STRIPE_PLAN_IDS,
  ...TEAM_PLAN_IDS,
] as const;
export type StripePaidPlanId = (typeof STRIPE_PAID_PLAN_IDS)[number];

export function isStripePaidPlanId(value: string): value is StripePaidPlanId {
  return (STRIPE_PAID_PLAN_IDS as readonly string[]).includes(value);
}

export type PaidPlanIdForCheckout = StripePaidPlanId;
export type TeamStripePlanId = TeamPlanId;
