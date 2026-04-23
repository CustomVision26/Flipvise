import {
  personalDashboardPlanQueryValue,
  type TeamPlanId,
} from "@/lib/team-plans";

/** Canonical personal `/dashboard` URL with `userid` + `plan` query (matches header / layout). */
export function personalDashboardHref(
  userId: string,
  activeTeamPlan: TeamPlanId | null,
  isPro: boolean,
): string {
  return `/dashboard?${new URLSearchParams({
    userid: userId,
    plan: personalDashboardPlanQueryValue(activeTeamPlan, isPro),
  }).toString()}`;
}
