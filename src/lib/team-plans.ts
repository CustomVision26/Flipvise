import { CARDS_PER_DECK_LIMIT_PRO_PLUS } from "@/lib/deck-limits";
import { PRO_PLUS_PERSONAL_DECK_LIMIT } from "@/lib/personal-plan-limits";

/** Clerk Billing plan ids for team tiers — configure matching plans + features in Clerk Dashboard. */
export const TEAM_PLAN_IDS = [
  "pro_plus_team_basic",
  "pro_plus_team_gold",
  "pro_plus_platinum_plan",
  "pro_plus_enterprise",
] as const;

export type TeamPlanId = (typeof TEAM_PLAN_IDS)[number];

/** Maps legacy Stripe / Clerk slugs to canonical ids (existing subscriptions & DB rows). */
export const LEGACY_TEAM_PLAN_TO_CANONICAL: Record<string, TeamPlanId> = {
  pro_team_basic: "pro_plus_team_basic",
  pro_team_gold: "pro_plus_team_gold",
  pro_platinum_plan: "pro_plus_platinum_plan",
  pro_enterprise: "pro_plus_enterprise",
};

/** Short labels for UI (header, settings) — not Clerk Dashboard ids. */
export const TEAM_PLAN_LABELS: Record<TeamPlanId, string> = {
  pro_plus_team_basic: "Team Basic",
  pro_plus_team_gold: "Team Gold",
  pro_plus_platinum_plan: "Platinum",
  pro_plus_enterprise: "Enterprise",
};

export function canonicalTeamPlanId(slug: string): TeamPlanId | null {
  if ((TEAM_PLAN_IDS as readonly string[]).includes(slug)) return slug as TeamPlanId;
  return LEGACY_TEAM_PLAN_TO_CANONICAL[slug] ?? null;
}

export function resolveActiveTeamPlanFromHas(
  has: ((a: { plan: string } | { feature: string }) => boolean | undefined) | undefined,
): TeamPlanId | null {
  if (!has) return null;
  for (const plan of TEAM_PLAN_IDS) {
    if (has({ plan })) return plan;
  }
  for (const legacy of Object.keys(LEGACY_TEAM_PLAN_TO_CANONICAL)) {
    if (has({ plan: legacy })) {
      return LEGACY_TEAM_PLAN_TO_CANONICAL[legacy]!;
    }
  }
  return null;
}

export const TEAM_PLAN_LIMITS: Record<
  TeamPlanId,
  { maxTeams: number; maxMembersPerTeam: number; maxDecksPerWorkspace: number }
> = {
  /** Decks per workspace match Pro Plus personal ({@link PRO_PLUS_PERSONAL_DECK_LIMIT}); tiers differ by workspaces count + members. */
  pro_plus_team_basic: {
    maxTeams: 2,
    maxMembersPerTeam: 5,
    maxDecksPerWorkspace: PRO_PLUS_PERSONAL_DECK_LIMIT,
  },
  pro_plus_team_gold: {
    maxTeams: 5,
    maxMembersPerTeam: 15,
    maxDecksPerWorkspace: PRO_PLUS_PERSONAL_DECK_LIMIT,
  },
  pro_plus_platinum_plan: {
    maxTeams: 10,
    maxMembersPerTeam: 25,
    maxDecksPerWorkspace: PRO_PLUS_PERSONAL_DECK_LIMIT,
  },
  pro_plus_enterprise: {
    maxTeams: 20,
    maxMembersPerTeam: 35,
    maxDecksPerWorkspace: PRO_PLUS_PERSONAL_DECK_LIMIT,
  },
};

export function isTeamPlanId(slug: string): boolean {
  return canonicalTeamPlanId(slug) !== null;
}

/** Personal `plan=` query: team-tier Clerk id, else personal paid slug, else free (empty). */
export function personalDashboardPlanQueryValue(
  activeTeamPlan: TeamPlanId | null,
  isPro: boolean,
  personalStripeSlug?: "pro" | "pro_plus" | null,
): string {
  if (activeTeamPlan !== null) return activeTeamPlan;
  if (personalStripeSlug === "pro_plus") return "pro_plus";
  if (isPro && personalStripeSlug === "pro") return "pro";
  if (isPro) return "pro";
  return "";
}

/**
 * True when the `plan` query matches a subscriber-shaped workspace URL: personal Pro / Pro Plus
 * or a known team-tier plan id.
 */
export function isWorkspaceSubscriberPlanQueryParam(plan: string): boolean {
  const p = plan.trim().toLowerCase();
  return p === "pro" || p === "pro_plus" || isTeamPlanId(p);
}

export function limitsForPlan(planSlug: string) {
  const canonical = canonicalTeamPlanId(planSlug);
  if (canonical) return TEAM_PLAN_LIMITS[canonical];
  return { maxTeams: 0, maxMembersPerTeam: 0, maxDecksPerWorkspace: 0 };
}

/**
 * Max flashcards across all subscriber-owned decks in a team workspace if each deck is filled to
 * the team-tier per-deck cap ({@link CARDS_PER_DECK_LIMIT_PRO_PLUS}).
 */
export function workspaceCardsCapacityForPlan(planSlug: string): number {
  const lim = limitsForPlan(planSlug);
  if (!lim.maxDecksPerWorkspace) return 0;
  return lim.maxDecksPerWorkspace * CARDS_PER_DECK_LIMIT_PRO_PLUS;
}

export function labelForTeamPlanSlug(slug: string): string | undefined {
  const canonical = canonicalTeamPlanId(slug);
  return canonical ? TEAM_PLAN_LABELS[canonical] : undefined;
}
