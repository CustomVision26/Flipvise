import {
  personalDashboardPlanQueryValue,
  type TeamPlanId,
} from "@/lib/team-plans";

/**
 * Personal dashboard URL with no query string — used where a clean path is preferable
 * (pricing/admin fallbacks, legacy links). After sign-in, prefer
 * {@link personalDashboardHrefWithUserPlanQuery}.
 *
 * Workspace switcher “Personal Dash” links use {@link personalDashboardHrefWithUserPlanQuery}.
 */
export function personalDashboardHref(): string {
  return "/dashboard";
}

export type PersonalDashboardHrefWithPlanInput = {
  userId: string;
  activeTeamPlan: TeamPlanId | null;
  isPro: boolean;
  hasClerkPersonalPro: boolean;
  hasClerkPersonalProPlus: boolean;
};

/** `?userid=` + optional `plan=` — must match signed-in user; see `canonicalDashboardPathRemovingSensitiveQuery`. */
export function personalDashboardHrefWithUserPlanQuery(
  input: PersonalDashboardHrefWithPlanInput,
): string {
  const personalStripeSlug = input.hasClerkPersonalProPlus
    ? ("pro_plus" as const)
    : input.hasClerkPersonalPro
      ? ("pro" as const)
      : null;

  const planQuery = personalDashboardPlanQueryValue(
    input.activeTeamPlan,
    input.isPro,
    personalStripeSlug,
  );
  const params = new URLSearchParams({ userid: input.userId });
  if (planQuery !== "") params.set("plan", planQuery);
  return `/dashboard?${params.toString()}`;
}

/**
 * Stripe Checkout `success_url` — same `userid` / `plan` shape as the workspace switcher,
 * plus `checkout=success` for post-payment sync toast.
 */
export function personalDashboardHrefAfterCheckoutSuccess(input: {
  userId: string;
  purchasedPlanSlug: string;
}): string {
  const slug = input.purchasedPlanSlug.trim();
  const params = new URLSearchParams({
    userid: input.userId,
    checkout: "success",
  });
  if (slug) params.set("plan", slug);
  return `/dashboard?${params.toString()}`;
}
