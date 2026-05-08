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

/**
 * Human-readable feature list per plan.
 * This is written into subscription_data.description so it appears on
 * every Stripe-generated invoice and receipt under the plan name.
 */
const PLAN_FEATURES: Record<PaidPlanId, string[]> = {
  pro: [
    "Up to 15 decks",
    "AI flashcard generation",
    "Up to 30 cards per deck",
    "Standard reviews and quiz",
    "Multiple interface colors",
  ],
  pro_plus: [
    "Up to 25 decks",
    "AI flashcard generation",
    "Up to 52 cards per deck",
    "Standard reviews and quiz",
    "Multiple interface colors",
    "AI reading",
  ],
  pro_plus_team_basic: [
    "Everything in Pro Plus for your personal workspace",
    "Up to 2 team workspaces",
    "Up to 5 members per workspace",
    "Team deck sharing",
    "Team progress tracking",
  ],
  pro_plus_team_gold: [
    "Everything in Team Basic",
    "Up to 5 team workspaces",
    "Up to 15 members per workspace",
  ],
  pro_plus_platinum_plan: [
    "Everything in Team Gold",
    "Up to 10 team workspaces",
    "Up to 25 members per workspace",
  ],
  pro_plus_enterprise: [
    "Everything in Platinum",
    "Up to 20 team workspaces",
    "Up to 40 members per workspace",
  ],
};

const PLAN_DISPLAY_NAMES: Record<PaidPlanId, string> = {
  pro: "Pro",
  pro_plus: "Pro Plus",
  pro_plus_team_basic: "Team Basic",
  pro_plus_team_gold: "Team Gold",
  pro_plus_platinum_plan: "Platinum",
  pro_plus_enterprise: "Enterprise",
};

/** Builds the subscription description shown on invoices. */
function planDescription(plan: PaidPlanId, period: BillingPeriod): string {
  const name = PLAN_DISPLAY_NAMES[plan];
  const billing = period === "yearly" ? "Annual" : "Monthly";
  const features = PLAN_FEATURES[plan].map((f) => `• ${f}`).join("\n");
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

/** Returns the active Stripe coupon ID for a plan, or null if no discount applies. */
async function activeCouponIdForPlan(planId: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), "src", "data", "plans-config.json"),
      "utf-8",
    );
    const plans = JSON.parse(raw) as PlanConfig[];
    const plan = plans.find((p) => p.id === planId);
    const discount = plan?.discount;
    if (discount?.active && discount.stripeCouponId.trim()) {
      return discount.stripeCouponId.trim();
    }
    return null;
  } catch {
    return null;
  }
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

  const priceId = priceIdForPlan(plan, period);
  const description = planDescription(plan, period);
  const couponId = await activeCouponIdForPlan(plan);

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
