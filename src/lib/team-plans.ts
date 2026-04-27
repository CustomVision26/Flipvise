/** Clerk Billing plan ids for team tiers — configure matching plans + features in Clerk Dashboard. */
export const TEAM_PLAN_IDS = [
  "pro_team_basic",
  "pro_team_gold",
  "pro_platinum_plan",
  "pro_enterprise",
] as const;

export type TeamPlanId = (typeof TEAM_PLAN_IDS)[number];

/** Short labels for UI (header, settings) — not Clerk Dashboard ids. */
export const TEAM_PLAN_LABELS: Record<TeamPlanId, string> = {
  pro_team_basic: "Team Basic",
  pro_team_gold: "Team Gold",
  pro_platinum_plan: "Platinum",
  pro_enterprise: "Enterprise",
};

export function resolveActiveTeamPlanFromHas(
  has: ((a: { plan: string }) => boolean | undefined) | undefined,
): TeamPlanId | null {
  if (!has) return null;
  for (const plan of TEAM_PLAN_IDS) {
    if (has({ plan })) return plan;
  }
  return null;
}

export const TEAM_PLAN_LIMITS: Record<
  TeamPlanId,
  { maxTeams: number; maxMembersPerTeam: number }
> = {
  pro_team_basic: { maxTeams: 2, maxMembersPerTeam: 5 },
  pro_team_gold: { maxTeams: 5, maxMembersPerTeam: 15 },
  pro_platinum_plan: { maxTeams: 10, maxMembersPerTeam: 25 },
  pro_enterprise: { maxTeams: 20, maxMembersPerTeam: 35 },
};

export function isTeamPlanId(slug: string): slug is TeamPlanId {
  return (TEAM_PLAN_IDS as readonly string[]).includes(slug);
}

/** Personal `plan=` query: team-tier Clerk id, else personal Pro `pro`, else free (empty). */
export function personalDashboardPlanQueryValue(
  activeTeamPlan: TeamPlanId | null,
  isPro: boolean,
): string {
  if (activeTeamPlan !== null) return activeTeamPlan;
  if (isPro) return "pro";
  return "";
}

/**
 * True when the `plan` query matches a subscriber-shaped workspace URL: personal Pro (`pro`)
 * or a known team-tier plan id.
 */
export function isWorkspaceSubscriberPlanQueryParam(plan: string): boolean {
  const p = plan.trim().toLowerCase();
  return p === "pro" || isTeamPlanId(p);
}

export function limitsForPlan(planSlug: string) {
  if (isTeamPlanId(planSlug)) return TEAM_PLAN_LIMITS[planSlug];
  return { maxTeams: 0, maxMembersPerTeam: 0 };
}
