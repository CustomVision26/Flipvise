import { TEAM_PLAN_LABELS, type TeamPlanId } from "@/lib/team-plans";

/**
 * Display label for the personal workspace row in the header switcher (`Personal Dash · …`).
 * Platform admins / complimentary unlock use Pro Plus (not Pro) — matches `getAccessContext()`.
 */
export function personalWorkspacePlanDisplayLabel(input: {
  activeTeamPlan: TeamPlanId | null;
  isPro: boolean;
  /** From `getAccessContext()` — true for Pro Plus, team-tier personal caps, and platform admins. */
  hasProPlusInterfacePalette: boolean;
}): string {
  if (input.activeTeamPlan != null) {
    return TEAM_PLAN_LABELS[input.activeTeamPlan];
  }
  if (input.hasProPlusInterfacePalette) {
    return "Pro Plus";
  }
  if (input.isPro) {
    return "Pro";
  }
  return "Free";
}
