"use server";

import { auth } from "@/lib/clerk-auth";
import {
  STRIPE_PAID_PLAN_IDS,
  type StripePaidPlanId,
} from "@/lib/billing-plan-ids";
import { stripe, resolveAppUrl } from "@/lib/stripe";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import type { PlanConfig } from "@/components/pricing-content";
import { getActiveStripeSubscription } from "@/db/queries/stripe-subscriptions";
import {
  readStripePriceIdFromEnv,
  stripePriceEnvPairForPlan,
} from "@/lib/stripe-plan-price-env";

const PAID_PLAN_IDS = STRIPE_PAID_PLAN_IDS;
type PaidPlanId = StripePaidPlanId;
const BILLING_PERIODS = ["monthly", "yearly"] as const;
type BillingPeriod = (typeof BILLING_PERIODS)[number];

const createCheckoutSessionSchema = z.object({
  plan: z.enum(PAID_PLAN_IDS).default("pro"),
  period: z.enum(BILLING_PERIODS).default("monthly"),
});
type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>;

/** Last-resort copy if `plans-config.json` is missing a paid row (should not happen in production). */
const PLAN_DISPLAY_NAMES_FALLBACK: Record<PaidPlanId, string> = {
  pro: "Pro",
  pro_plus: "Pro Plus",
  pro_plus_team_basic: "Team Basic",
  pro_plus_team_gold: "Team Gold",
  pro_plus_platinum_plan: "Platinum",
  pro_plus_enterprise: "Enterprise",
};

const PLAN_FEATURES_FALLBACK: Record<PaidPlanId, string[]> = {
  pro: [
    "10 decks",
    "AI flashcard generation",
    "30 cards per deck",
    "Standard reviews and quiz",
    "Multiple interface colors",
  ],
  pro_plus: [
    "15 decks",
    "AI flashcard generation",
    "52 cards per deck",
    "Standard reviews and quiz",
    "Multiple interface colors",
    "AI reading",
  ],
  pro_plus_team_basic: [
    "Pro Plus features on your personal workspace",
    "Up to 2 team workspaces",
    "Up to 5 members per workspace",
    "Team membership",
    "Deck sharing",
    "Team progress tracker",
  ],
  pro_plus_team_gold: [
    "Pro Plus features on your personal workspace",
    "Up to 5 team workspaces",
    "Up to 15 members per workspace",
    "Team membership",
    "Deck sharing",
    "Team progress tracker",
  ],
  pro_plus_platinum_plan: [
    "Pro Plus features on your personal workspace",
    "Up to 10 team workspaces",
    "Up to 25 members per workspace",
    "Team membership",
    "Deck sharing",
    "Team progress tracker",
  ],
  pro_plus_enterprise: [
    "Pro Plus features on your personal workspace",
    "Up to 20 team workspaces",
    "Up to 35 members per workspace",
    "Team membership",
    "Deck sharing",
    "Team progress tracker",
  ],
};

async function readPlansConfig(): Promise<PlanConfig[]> {
  const raw = await fs.readFile(
    path.join(process.cwd(), "src", "data", "plans-config.json"),
    "utf-8",
  );
  return JSON.parse(raw) as PlanConfig[];
}

function couponIdFromPlansConfig(plans: PlanConfig[], planId: string): string | null {
  const plan = plans.find((p) => p.id === planId);
  const discount = plan?.discount;
  if (discount?.active && discount.stripeCouponId.trim()) {
    return discount.stripeCouponId.trim();
  }
  return null;
}

/**
 * Matches `/pricing` and admin Plans editor: pulls `name` + `features` from `plans-config.json`
 * so Stripe invoices/receipts stay in sync with the cards UI.
 */
function subscriptionDescriptionFromPlansConfig(
  plan: PaidPlanId,
  period: BillingPeriod,
  plans: PlanConfig[],
): string {
  const row = plans.find((p) => p.id === plan);
  const name = row?.name?.trim() || PLAN_DISPLAY_NAMES_FALLBACK[plan];
  const featureList =
    row?.features?.length ? row.features : PLAN_FEATURES_FALLBACK[plan];
  const billing = period === "yearly" ? "Annual" : "Monthly";
  const features = featureList.map((f) => `• ${f}`).join("\n");
  return `Flipvise ${name} — ${billing}\n\n${features}`;
}

function priceIdForPlan(plan: PaidPlanId, period: BillingPeriod): string {
  const pair = stripePriceEnvPairForPlan(plan, period);
  const primaryEnv = pair.primary;
  const priceId = readStripePriceIdFromEnv(pair);
  if (!priceId) {
    throw new Error(
      `Missing Stripe price id env var ${primaryEnv}${pair.fallback ? ` (fallback ${pair.fallback} also empty)` : ""} for plan: ${plan} (${period})`,
    );
  }
  return priceId;
}

function envVarForPlan(plan: PaidPlanId, period: BillingPeriod): string {
  return stripePriceEnvPairForPlan(plan, period).primary;
}

export async function createStripeCheckoutSessionAction(
  data: CreateCheckoutSessionInput,
): Promise<{ url: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = createCheckoutSessionSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");
  const { plan, period } = parsed.data;

  let plansConfig: PlanConfig[] = [];
  try {
    plansConfig = await readPlansConfig();
  } catch {
    // Same resilience as legacy coupon loader — checkout can proceed with fallbacks.
  }

  const priceId = priceIdForPlan(plan, period);
  const description = subscriptionDescriptionFromPlansConfig(plan, period, plansConfig);
  const couponId = couponIdFromPlansConfig(plansConfig, plan);

  const appUrl = resolveAppUrl();
  const successUrl = `${appUrl}/dashboard`;
  const cancelUrl = `${appUrl}/pricing`;

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      ...(couponId
        ? { discounts: [{ coupon: couponId }] }
        : { allow_promotion_codes: true }),
      subscription_data: {
        description,
        metadata: {
          clerkUserId: userId,
          plan,
          period,
        },
      },
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        clerkUserId: userId,
        plan,
        period,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "type" in error &&
      typeof error.type === "string" &&
      error.type === "StripeInvalidRequestError" &&
      error.message.includes("No such price")
    ) {
      const envVar = envVarForPlan(plan, period);
      throw new Error(
        `Stripe price not found for plan "${plan}" (${period}). Check ${envVar}=${priceId} and make sure it belongs to the same Stripe mode/account as STRIPE_SECRET_KEY (test with test, live with live).`,
      );
    }
    throw error;
  }

  if (!session.url) {
    throw new Error("Failed to create checkout session");
  }

  return { url: session.url };
}

export async function createBillingPortalSessionAction(): Promise<{
  url: string;
}> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const sub = await getActiveStripeSubscription(userId);
  if (!sub?.stripeCustomerId) {
    throw new Error(
      "No active subscription found. Please subscribe to a plan first.",
    );
  }

  const appUrl = resolveAppUrl();

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${appUrl}/pricing`,
  });

  return { url: session.url };
}
