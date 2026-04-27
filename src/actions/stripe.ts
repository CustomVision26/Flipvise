"use server";

import { auth } from "@/lib/clerk-auth";
import { TEAM_PLAN_IDS } from "@/lib/team-plans";
import { stripe, resolveAppUrl } from "@/lib/stripe";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import type { PlanConfig } from "@/components/pricing-content";
import { getActiveStripeSubscription } from "@/db/queries/stripe-subscriptions";

const PAID_PLAN_IDS = ["pro", ...TEAM_PLAN_IDS] as const;
type PaidPlanId = (typeof PAID_PLAN_IDS)[number];
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
    "Unlimited decks",
    "AI flashcard generation",
    "75 cards per deck",
    "12 interface color themes",
    "Priority support",
  ],
  pro_team_basic: [
    "Everything in Pro",
    "Up to 2 team workspaces",
    "Up to 5 members per workspace",
    "Team deck sharing",
    "Team admin dashboard",
  ],
  pro_team_gold: [
    "Everything in Team Basic",
    "Up to 5 team workspaces",
    "Up to 15 members per workspace",
  ],
  pro_platinum_plan: [
    "Everything in Team Gold",
    "Up to 10 team workspaces",
    "Up to 25 members per workspace",
  ],
  pro_enterprise: [
    "Everything in Platinum",
    "Up to 30 team workspaces",
    "Up to 40 members per workspace",
  ],
};

const PLAN_DISPLAY_NAMES: Record<PaidPlanId, string> = {
  pro: "Pro",
  pro_team_basic: "Team Basic",
  pro_team_gold: "Team Gold",
  pro_platinum_plan: "Platinum",
  pro_enterprise: "Enterprise",
};

/** Builds the subscription description shown on invoices. */
function planDescription(plan: PaidPlanId, period: BillingPeriod): string {
  const name = PLAN_DISPLAY_NAMES[plan];
  const billing = period === "yearly" ? "Annual" : "Monthly";
  const features = PLAN_FEATURES[plan].map((f) => `• ${f}`).join("\n");
  return `Flipvise ${name} — ${billing}\n\n${features}`;
}

function priceIdForPlan(plan: PaidPlanId, period: BillingPeriod): string {
  const monthlyEnvByPlan: Record<PaidPlanId, string> = {
    pro: "STRIPE_PRO_PRICE_ID",
    pro_team_basic: "STRIPE_PRO_TEAM_BASIC_PRICE_ID",
    pro_team_gold: "STRIPE_PRO_TEAM_GOLD_PRICE_ID",
    pro_platinum_plan: "STRIPE_PRO_PLATINUM_PLAN_PRICE_ID",
    pro_enterprise: "STRIPE_PRO_ENTERPRISE_PRICE_ID",
  };
  const yearlyEnvByPlan: Record<PaidPlanId, string> = {
    pro: "STRIPE_PRO_YEARLY_PRICE_ID",
    pro_team_basic: "STRIPE_PRO_TEAM_BASIC_YEARLY_PRICE_ID",
    pro_team_gold: "STRIPE_PRO_TEAM_GOLD_YEARLY_PRICE_ID",
    pro_platinum_plan: "STRIPE_PRO_PLATINUM_PLAN_YEARLY_PRICE_ID",
    pro_enterprise: "STRIPE_PRO_ENTERPRISE_YEARLY_PRICE_ID",
  };
  const envVar = period === "monthly" ? monthlyEnvByPlan[plan] : yearlyEnvByPlan[plan];
  const value = process.env[envVar];
  const priceId = value?.trim();
  if (!priceId) {
    throw new Error(`Missing Stripe price id env var ${envVar} for plan: ${plan} (${period})`);
  }
  if (!priceId.startsWith("price_")) {
    throw new Error(
      `Invalid Stripe price id in ${envVar}: expected value starting with "price_" but got "${priceId}"`,
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
  const monthlyByPlan: Record<PaidPlanId, string> = {
    pro: "STRIPE_PRO_PRICE_ID",
    pro_team_basic: "STRIPE_PRO_TEAM_BASIC_PRICE_ID",
    pro_team_gold: "STRIPE_PRO_TEAM_GOLD_PRICE_ID",
    pro_platinum_plan: "STRIPE_PRO_PLATINUM_PLAN_PRICE_ID",
    pro_enterprise: "STRIPE_PRO_ENTERPRISE_PRICE_ID",
  };
  const yearlyByPlan: Record<PaidPlanId, string> = {
    pro: "STRIPE_PRO_YEARLY_PRICE_ID",
    pro_team_basic: "STRIPE_PRO_TEAM_BASIC_YEARLY_PRICE_ID",
    pro_team_gold: "STRIPE_PRO_TEAM_GOLD_YEARLY_PRICE_ID",
    pro_platinum_plan: "STRIPE_PRO_PLATINUM_PLAN_YEARLY_PRICE_ID",
    pro_enterprise: "STRIPE_PRO_ENTERPRISE_YEARLY_PRICE_ID",
  };

  return period === "monthly" ? monthlyByPlan[plan] : yearlyByPlan[plan];
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
  // Look up an active admin-configured discount coupon for this plan.
  const couponId = await activeCouponIdForPlan(plan);

  const appUrl = resolveAppUrl();
  const successUrl = `${appUrl}/dashboard?userid=${encodeURIComponent(userId)}&plan=${encodeURIComponent(plan)}`;
  const cancelUrl = `${appUrl}/pricing`;

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      // Omitting payment_method_types lets Stripe use dynamic payment methods
      // (cards, wallets, bank debits) based on the customer's location.
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // ── Discount coupon ───────────────────────────────────────────────────
      // When an admin-configured coupon is active for this plan, apply it
      // directly so it appears on the Stripe checkout, invoice, and receipt.
      // Note: Stripe does not allow `discounts` and `allow_promotion_codes`
      // at the same time — the coupon takes priority.
      ...(couponId
        ? { discounts: [{ coupon: couponId }] }
        : { allow_promotion_codes: true }),
      // ── Features on invoices ──────────────────────────────────────────────
      // subscription_data.description appears on every Stripe invoice and
      // receipt email under the plan name line item.
      subscription_data: {
        description,
        metadata: {
          clerkUserId: userId,
          plan,
          period,
        },
      },
      // ── Tax calculation ───────────────────────────────────────────────────
      // Requires "Stripe Tax" to be enabled in your Stripe Dashboard
      // (Tax → Get started). Stripe then calculates the correct rate
      // based on the customer's billing address and shows the tax
      // breakdown on the invoice and receipt.
      automatic_tax: { enabled: true },
      // Collect full billing address so Stripe Tax can determine jurisdiction.
      billing_address_collection: "required",
      // Allow business customers to enter a VAT / GST / tax ID.
      // The ID is validated and printed on the invoice (B2B receipts).
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

/**
 * Opens the Stripe Customer Portal for the current user.
 * The portal lets subscribers upgrade, downgrade, cancel, and update payment
 * methods — with proration handled automatically by Stripe.
 *
 * Requires:
 *  - The user to have an existing Stripe subscription stored in stripe_subscriptions.
 *  - The Customer Portal to be configured in the Stripe Dashboard
 *    (Billing → Customer portal).
 */
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
