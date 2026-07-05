import type { StripePaidPlanId } from "@/lib/billing-plan-ids";

type EnvPair = { primary: string; fallback?: string };

const PRICE_ENV_MONTHLY: Record<StripePaidPlanId, EnvPair> = {
  pro: { primary: "STRIPE_PRO_PRICE_ID" },
  pro_plus: { primary: "STRIPE_PRO_PLUS_PRICE_ID" },
  pro_plus_team_basic: {
    primary: "STRIPE_PRO_PLUS_TEAM_BASIC_PRICE_ID",
    fallback: "STRIPE_PRO_TEAM_BASIC_PRICE_ID",
  },
  pro_plus_team_gold: {
    primary: "STRIPE_PRO_PLUS_TEAM_GOLD_PRICE_ID",
    fallback: "STRIPE_PRO_TEAM_GOLD_PRICE_ID",
  },
  pro_plus_platinum_plan: {
    primary: "STRIPE_PRO_PLUS_PLATINUM_PLAN_PRICE_ID",
    fallback: "STRIPE_PRO_PLATINUM_PLAN_PRICE_ID",
  },
  pro_plus_enterprise: {
    primary: "STRIPE_PRO_PLUS_ENTERPRISE_PRICE_ID",
    fallback: "STRIPE_PRO_ENTERPRISE_PRICE_ID",
  },
  education_plus: { primary: "STRIPE_EDUCATION_PLUS_PRICE_ID" },
  education_gold: { primary: "STRIPE_EDUCATION_GOLD_PRICE_ID" },
  education_enterprise: { primary: "STRIPE_EDUCATION_ENTERPRISE_PRICE_ID" },
};

const PRICE_ENV_YEARLY: Record<StripePaidPlanId, EnvPair> = {
  pro: { primary: "STRIPE_PRO_YEARLY_PRICE_ID" },
  pro_plus: { primary: "STRIPE_PRO_PLUS_YEARLY_PRICE_ID" },
  pro_plus_team_basic: {
    primary: "STRIPE_PRO_PLUS_TEAM_BASIC_YEARLY_PRICE_ID",
    fallback: "STRIPE_PRO_TEAM_BASIC_YEARLY_PRICE_ID",
  },
  pro_plus_team_gold: {
    primary: "STRIPE_PRO_PLUS_TEAM_GOLD_YEARLY_PRICE_ID",
    fallback: "STRIPE_PRO_TEAM_GOLD_YEARLY_PRICE_ID",
  },
  pro_plus_platinum_plan: {
    primary: "STRIPE_PRO_PLUS_PLATINUM_PLAN_YEARLY_PRICE_ID",
    fallback: "STRIPE_PRO_PLATINUM_PLAN_YEARLY_PRICE_ID",
  },
  pro_plus_enterprise: {
    primary: "STRIPE_PRO_PLUS_ENTERPRISE_YEARLY_PRICE_ID",
    fallback: "STRIPE_PRO_ENTERPRISE_YEARLY_PRICE_ID",
  },
  education_plus: { primary: "STRIPE_EDUCATION_YEARLY_PLUS_PRICE_ID" },
  education_gold: { primary: "STRIPE_EDUCATION_YEARLY_GOLD_PRICE_ID" },
  education_enterprise: {
    primary: "STRIPE_EDUCATION_YEARLY_ENTERPRISE_PRICE_ID",
  },
};

export function readStripePriceIdFromEnv(pair: EnvPair): string | null {
  for (const key of [pair.primary, pair.fallback].filter(Boolean) as string[]) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    const value = raw.replace(/^['"]+|['"]+$/g, "").trim();
    if (value.startsWith("price_")) return value;
  }
  return null;
}

export function stripePriceEnvPairForPlan(
  plan: StripePaidPlanId,
  period: "monthly" | "yearly",
): EnvPair {
  return period === "monthly" ? PRICE_ENV_MONTHLY[plan] : PRICE_ENV_YEARLY[plan];
}

export function resolveStripePriceIdForPlan(
  plan: StripePaidPlanId,
  period: "monthly" | "yearly",
): string | null {
  return readStripePriceIdFromEnv(stripePriceEnvPairForPlan(plan, period));
}

let priceIdToPlanCache: Map<string, StripePaidPlanId> | null = null;

function buildPriceIdToPlanCache(): Map<string, StripePaidPlanId> {
  const map = new Map<string, StripePaidPlanId>();
  const plans = Object.keys(PRICE_ENV_MONTHLY) as StripePaidPlanId[];
  for (const plan of plans) {
    for (const period of ["monthly", "yearly"] as const) {
      const priceId = resolveStripePriceIdForPlan(plan, period);
      if (priceId) map.set(priceId, plan);
    }
  }
  return map;
}

/** Reverse lookup: Stripe price id → billing plan slug (from env vars). */
export function planSlugFromStripePriceId(
  priceId: string | null | undefined,
): StripePaidPlanId | null {
  const id = priceId?.trim();
  if (!id?.startsWith("price_")) return null;
  priceIdToPlanCache ??= buildPriceIdToPlanCache();
  return priceIdToPlanCache.get(id) ?? null;
}
