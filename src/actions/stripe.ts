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
import {
  getActiveStripeSubscription,
  getManageableStripeSubscription,
} from "@/db/queries/stripe-subscriptions";
import {
  readStripePriceIdFromEnv,
  stripePriceEnvPairForPlan,
} from "@/lib/stripe-plan-price-env";
import {
  ensureGeneralPlanStripeCoupon,
  resolveCheckoutDiscount,
  resolveStripeCheckoutDiscountPayload,
} from "@/lib/stripe-checkout-discount";
import {
  fetchCancelSubscriptionPreview,
  scheduleSubscriptionCancelAtPeriodEnd,
  type CancelSubscriptionPreview,
} from "@/lib/stripe-cancel-subscription";
import { getClerkUserFieldDisplayById } from "@/lib/clerk-user-display";
import {
  fetchUpgradableStripeSubscription,
  tryUpgradeExistingStripeSubscription,
} from "@/lib/apply-plan-upgrade";
import { personalDashboardHrefAfterCheckoutSuccess } from "@/lib/personal-dashboard-url";

const PAID_PLAN_IDS = STRIPE_PAID_PLAN_IDS;
type PaidPlanId = StripePaidPlanId;
const BILLING_PERIODS = ["monthly", "yearly"] as const;
type BillingPeriod = (typeof BILLING_PERIODS)[number];

const createCheckoutSessionSchema = z.object({
  plan: z.enum(PAID_PLAN_IDS).default("pro"),
  period: z.enum(BILLING_PERIODS).default("monthly"),
  promotionCode: z.string().max(128).optional(),
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

type CheckoutCustomerSessionParams =
  | {
      customer: string;
      /** Required when `tax_id_collection` + `billing_address_collection` use an existing customer. */
      customer_update: { name: "auto"; address: "auto" };
    }
  | { customer_email: string };

/** Reuse Stripe customer when known; otherwise prefill Checkout email from Clerk. */
async function isStripeCustomerReachable(customerId: string): Promise<boolean> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return !("deleted" in customer && customer.deleted);
  } catch {
    return false;
  }
}

/** Reuse Stripe customer when known; otherwise prefill Checkout email from Clerk. */
async function resolveCheckoutCustomerParams(
  userId: string,
): Promise<CheckoutCustomerSessionParams | Record<string, never>> {
  const sub =
    (await getManageableStripeSubscription(userId)) ??
    (await getActiveStripeSubscription(userId));
  if (sub?.stripeCustomerId) {
    const reachable = await isStripeCustomerReachable(sub.stripeCustomerId);
    if (reachable) {
      return {
        customer: sub.stripeCustomerId,
        customer_update: {
          name: "auto",
          address: "auto",
        },
      };
    }
  }

  const { primaryEmail } = await getClerkUserFieldDisplayById(userId);
  const email = primaryEmail?.trim().toLowerCase();
  if (email) {
    return { customer_email: email };
  }

  return {};
}

function checkoutActionErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (
      "type" in error &&
      typeof error.type === "string" &&
      error.type === "StripeInvalidRequestError"
    ) {
      const message = error.message;
      if (/no such customer/i.test(message)) {
        return "Your saved billing profile is out of date. Please try checkout again.";
      }
      if (/no such price/i.test(message)) {
        return message;
      }
      if (/automatic tax/i.test(message)) {
        return "Stripe Tax is not configured for this account. Contact support or disable automatic tax in Stripe.";
      }
      return message;
    }
    return error.message;
  }
  return "Unable to start checkout. Please try again.";
}

export async function createStripeCheckoutSessionAction(
  data: CreateCheckoutSessionInput,
): Promise<{ url: string; upgradedInPlace?: boolean }> {
  try {
    return await createStripeCheckoutSessionActionInner(data);
  } catch (error) {
    throw new Error(checkoutActionErrorMessage(error));
  }
}

async function createStripeCheckoutSessionActionInner(
  data: CreateCheckoutSessionInput,
): Promise<{ url: string; upgradedInPlace?: boolean }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = createCheckoutSessionSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");
  const { plan, period, promotionCode } = parsed.data;

  const appUrl = resolveAppUrl();
  const successReturnUrl = `${appUrl}${personalDashboardHrefAfterCheckoutSuccess({
    userId,
    purchasedPlanSlug: plan,
  })}`;

  const trimmedPromo = promotionCode?.trim() ?? "";
  let upgradableSub = null;
  try {
    upgradableSub = await fetchUpgradableStripeSubscription(userId);
  } catch (error) {
    console.error("[createStripeCheckoutSessionAction] upgradable lookup:", error);
  }

  if (upgradableSub) {
    if (trimmedPromo) {
      throw new Error(
        "Promotion codes only apply to new subscriptions. Clear the promo field to change your existing plan — Stripe will prorate automatically.",
      );
    }
    try {
      const upgraded = await tryUpgradeExistingStripeSubscription({
        userId,
        planSlug: plan,
        period,
      });
      if (upgraded) {
        return { url: successReturnUrl, upgradedInPlace: true };
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("already on this plan")
      ) {
        return { url: successReturnUrl, upgradedInPlace: true };
      }
      throw error;
    }
  }

  let plansConfig: PlanConfig[] = [];
  try {
    plansConfig = await readPlansConfig();
  } catch {
    // Same resilience as legacy coupon loader — checkout can proceed with fallbacks.
  }

  const priceId = priceIdForPlan(plan, period);
  const description = subscriptionDescriptionFromPlansConfig(plan, period, plansConfig);

  const discountResolution = await resolveCheckoutDiscount({
    planId: plan,
    promotionCodeInput: promotionCode,
    plansConfig,
  });

  if (
    discountResolution.couponId != null &&
    discountResolution.affiliateId == null
  ) {
    const planRow = plansConfig.find((p) => p.id === plan);
    const discount = planRow?.discount;
    if (
      discount?.active &&
      (discount.value ?? 0) > 0 &&
      discount.stripeCouponId?.trim() === discountResolution.couponId
    ) {
      await ensureGeneralPlanStripeCoupon({
        planId: plan,
        discount,
        discontinueAt: planRow?.discontinueAt ?? null,
      });
    }
  }

  const checkoutDiscount =
    discountResolution.couponId != null
      ? await resolveStripeCheckoutDiscountPayload(discountResolution.couponId)
      : null;

  const successUrl = successReturnUrl;
  const cancelUrl = `${appUrl}/pricing?checkout=canceled`;

  const subscriptionMetadata: Record<string, string> = {
    clerkUserId: userId,
    plan,
    period,
  };
  if (discountResolution.affiliateId != null) {
    subscriptionMetadata.affiliateId = String(discountResolution.affiliateId);
  }

  const checkoutCustomer = await resolveCheckoutCustomerParams(userId);

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...checkoutCustomer,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      ...(checkoutDiscount ? { discounts: [checkoutDiscount] } : {}),
      ...(discountResolution.allowPromotionCodes
        ? { allow_promotion_codes: true }
        : {}),
      subscription_data: {
        description,
        metadata: subscriptionMetadata,
      },
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: subscriptionMetadata,
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

  const sub =
    (await getManageableStripeSubscription(userId)) ??
    (await getActiveStripeSubscription(userId));
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

export async function getCancelSubscriptionPreviewAction(): Promise<CancelSubscriptionPreview> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const sub = await getManageableStripeSubscription(userId);
  if (!sub) {
    throw new Error("No active paid subscription found.");
  }

  return fetchCancelSubscriptionPreview(
    sub.stripeSubscriptionId,
    sub.planSlug,
  );
}

/** Whether the signed-in user has a Stripe subscription row that can be canceled. */
export async function hasCancelableStripeSubscriptionAction(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  const sub = await getManageableStripeSubscription(userId);
  return sub != null;
}

/**
 * Opens Stripe Customer Portal on the subscription-cancel flow (proration and
 * timing follow your Stripe Dashboard portal settings).
 */
export async function createSubscriptionCancelPortalSessionAction(): Promise<{
  url: string;
}> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const sub = await getManageableStripeSubscription(userId);
  if (!sub?.stripeCustomerId) {
    throw new Error("No active subscription found.");
  }

  const appUrl = resolveAppUrl();

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${appUrl}/dashboard`,
    flow_data: {
      type: "subscription_cancel",
      subscription_cancel: {
        subscription: sub.stripeSubscriptionId,
      },
    },
  });
  if (!session.url) throw new Error("Missing portal URL");
  return { url: session.url };
}

/** Schedule cancel at period end without leaving the app (portal fallback). */
export async function cancelSubscriptionAtPeriodEndAction(): Promise<{
  periodEnd: string;
}> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const sub = await getManageableStripeSubscription(userId);
  if (!sub) throw new Error("No active subscription found.");

  const preview = await fetchCancelSubscriptionPreview(
    sub.stripeSubscriptionId,
    sub.planSlug,
  );
  if (preview.cancelAtPeriodEnd) {
    return { periodEnd: preview.periodEnd };
  }

  const result = await scheduleSubscriptionCancelAtPeriodEnd(
    sub.stripeSubscriptionId,
  );
  return { periodEnd: result.periodEnd };
}
