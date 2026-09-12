import type { EducationTeamPlanId } from "@/lib/education-plans";
import { type TeamPlanId } from "@/lib/team-plans";

/**
 * Personal dashboard URL. Billing identity lives in the Clerk session — never
 * `userid`, `plan`, or Stripe session ids in the address bar.
 */
export function personalDashboardHref(): string {
  return "/dashboard";
}

export type PersonalDashboardHrefWithPlanInput = {
  userId: string;
  activeTeamPlan: TeamPlanId | null;
  activeEducationTeamPlan?: EducationTeamPlanId | null;
  isPro: boolean;
  hasClerkPersonalPro: boolean;
  hasClerkPersonalProPlus: boolean;
};

/** Personal dashboard — query params are not used for identity. */
export function personalDashboardHrefWithUserPlanQuery(
  _input: PersonalDashboardHrefWithPlanInput,
): string {
  return personalDashboardHref();
}

/** Stripe Checkout success return — toast flag only. Session id is an httpOnly cookie. */
export function personalDashboardHrefAfterCheckoutSuccess(_input: {
  userId: string;
  purchasedPlanSlug: string;
}): string {
  return "/dashboard?checkout=success";
}

/** SetupIntent return after prorated plan swap. */
export function personalDashboardHrefAfterPlanChangeSuccess(_input: {
  userId: string;
  purchasedPlanSlug: string;
}): string {
  return "/dashboard?checkout=plan_change";
}

/** Add-on Checkout return_url. Session id is stored in an httpOnly cookie at create time. */
export function personalDashboardHrefAfterAddonCheckoutSuccess(_input: {
  userId: string;
  currentPlanSlug?: string | null;
}): string {
  return "/dashboard?checkout=success";
}
