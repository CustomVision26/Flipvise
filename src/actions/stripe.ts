"use server";

import { auth } from "@/lib/clerk-auth";
import {
  STRIPE_PAID_PLAN_IDS,
  type StripePaidPlanId,
} from "@/lib/billing-plan-ids";
import { stripe, resolveAppUrl } from "@/lib/stripe";
import { z } from "zod";
import type { PlanConfig } from "@/lib/plan-config-types";
import { readPlansConfigFromDisk } from "@/lib/plans-config-disk";
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
  noPromoCheckoutDiscount,
  resolveCheckoutDiscount,
  resolveStripeCheckoutDiscountPayload,
  resolveUnderlyingStripeCouponId,
  stampStripeCouponInvoiceLabel,
} from "@/lib/stripe-checkout-discount";
import {
  fetchCancelSubscriptionPreview,
  scheduleSubscriptionCancelAtPeriodEnd,
  type CancelSubscriptionPreview,
} from "@/lib/stripe-cancel-subscription";
import { getClerkUserFieldDisplayById } from "@/lib/clerk-user-display";
import { fetchUpgradableStripeSubscription } from "@/lib/apply-plan-upgrade";
import { checkoutPlanChangeRequiredError } from "@/lib/checkout-promo-errors";
import { personalDashboardHrefAfterCheckoutSuccess } from "@/lib/personal-dashboard-url";
import { stripeCheckoutElementsSessionParams } from "@/lib/stripe-checkout-branding";
import {
  isGeneralDiscountEffectivelyActive,
  resolvePlanPromoWindow,
} from "@/lib/plan-promo-window";
import { resolveCatalogAlignedStripePriceId } from "@/lib/stripe-catalog-price";
import { hasUserConsumedPlanTrial } from "@/db/queries/user-plan-trials";
import { resolveCheckoutTrialDays } from "@/lib/plan-trial";

const PAID_PLAN_IDS = STRIPE_PAID_PLAN_IDS;
type PaidPlanId = StripePaidPlanId;
const BILLING_PERIODS = ["monthly", "yearly"] as const;
type BillingPeriod = (typeof BILLING_PERIODS)[number];

const createCheckoutSessionSchema = z.object({
  plan: z.enum(PAID_PLAN_IDS).default("pro"),
  period: z.enum(BILLING_PERIODS).default("monthly"),
  promotionCode: z.string().max(128).optional(),
  startTrial: z.boolean().optional(),
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
  education_plus: "Education Plus",
  education_gold: "Education Gold",
  education_enterprise: "Education Enterprise",
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
  education_plus: [
    "Everything in Pro Plus",
    "AI Lesson Builder",
    "Curriculum Planner",
    "Learning Objectives Generator",
    "Classroom Activity Generator",
    "Grade-Level Difficulty Adjustment",
    "AI Quiz Generator",
    "Homework Generator",
    "Study Guide Generator",
    "Worksheet Generator",
    "Answer Key Generator",
    "Flashcards from Lesson Plans",
    "Weekly Lesson Planner",
    "Teacher Resource Library",
  ],
  education_gold: [
    "Everything in Team Gold",
    "Everything in Education Plus",
    "Teacher Collaboration",
    "Shared Lesson Library",
    "Department Workspace",
    "Shared Quizzes",
    "Shared Flashcards",
    "Student Progress Dashboard",
    "Teacher Analytics",
    "Up to 10 team workspaces",
    "Up to 25 members per workspace",
  ],
  education_enterprise: [
    "Everything in Enterprise",
    "Everything in Education Gold",
    "School Administration Dashboard",
    "Multi-campus Support",
    "Department Management",
    "Curriculum Management",
    "School Resource Library",
    "AI Classroom Assistant",
    "Learning Analytics",
    "School Branding",
    "Advanced User Roles",
    "Teacher Performance Reports",
    "Up to 30 team workspaces",
    "Up to 45 members per workspace",
  ],
};

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
    if (/missing stripe price id env var/i.test(error.message)) {
      if (/STRIPE_EDUCATION/i.test(error.message)) {
        return "Education plans are not available for checkout yet. Please contact support and we will help you subscribe.";
      }
      return "This plan is not available for checkout right now. Please contact support.";
    }
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
): Promise<CheckoutSessionActionResult> {
  try {
    return await createStripeCheckoutSessionActionInner(data);
  } catch (error) {
    throw new Error(checkoutActionErrorMessage(error));
  }
}

export type CheckoutSessionActionResult = {
  url?: string;
  sessionId?: string;
  clientSecret?: string;
  upgradedInPlace?: boolean;
  planLabel?: string;
  receiptUrl?: string | null;
  receiptIsProration?: boolean;
};

async function createStripeCheckoutSessionActionInner(
  data: CreateCheckoutSessionInput,
): Promise<CheckoutSessionActionResult> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = createCheckoutSessionSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");
  const { plan, period, promotionCode, startTrial } = parsed.data;

  const appUrl = resolveAppUrl();
  const successReturnPath = personalDashboardHrefAfterCheckoutSuccess({
    userId,
    purchasedPlanSlug: plan,
  });

  const upgradable = await fetchUpgradableStripeSubscription(userId);
  if (upgradable) {
    throw checkoutPlanChangeRequiredError();
  }

  let plansConfig: PlanConfig[] = [];
  try {
    plansConfig = await readPlansConfigFromDisk();
  } catch {
    // Same resilience as legacy coupon loader — checkout can proceed with fallbacks.
  }

  const planRow = plansConfig.find((p) => p.id === plan);
  const hasUsedTrial = await hasUserConsumedPlanTrial(userId);
  const hasActiveSub = (await getManageableStripeSubscription(userId)) != null;
  const trialDays =
    planRow != null
      ? resolveCheckoutTrialDays({
          plan: planRow,
          planId: plan,
          startTrial: Boolean(startTrial),
          hasUsedTrial,
          period,
        })
      : null;

  if (startTrial && trialDays == null) {
    throw new Error(
      hasUsedTrial
        ? "You have already used your free trial."
        : "This plan does not offer a free trial.",
    );
  }

  const priceId = planRow
    ? await resolveCatalogAlignedStripePriceId({
        plan,
        period,
        monthlyPrice: planRow.monthlyPrice,
        yearlyMonthlyPrice: planRow.yearlyMonthlyPrice,
      })
    : priceIdForPlan(plan, period);

  const description = subscriptionDescriptionFromPlansConfig(plan, period, plansConfig);

  const discountResolution =
    trialDays != null
      ? noPromoCheckoutDiscount()
      : await resolveCheckoutDiscount({
          planId: plan,
          promotionCodeInput: promotionCode,
          plansConfig,
          userId,
        });

  if (
    trialDays == null &&
    discountResolution.couponId != null &&
    discountResolution.affiliateId == null
  ) {
    const planRow = plansConfig.find((p) => p.id === plan);
    const discount = planRow?.discount;
    if (
      planRow &&
      isGeneralDiscountEffectivelyActive(planRow) &&
      discount?.stripeCouponId?.trim() === discountResolution.couponId
    ) {
      const { endsAt } = resolvePlanPromoWindow(planRow);
      await ensureGeneralPlanStripeCoupon({
        planId: plan,
        discount: discount!,
        discontinueAt: endsAt ?? planRow.discontinueAt ?? null,
      });
    }
  }

  const checkoutDiscount =
    trialDays == null && discountResolution.couponId != null
      ? await resolveStripeCheckoutDiscountPayload(discountResolution.couponId)
      : null;

  if (
    trialDays == null &&
    discountResolution.couponId != null &&
    discountResolution.customerPromoCode != null &&
    discountResolution.promoKind != null &&
    discountResolution.percentOff != null
  ) {
    const stripeCouponId = await resolveUnderlyingStripeCouponId(
      discountResolution.couponId,
    );
    await stampStripeCouponInvoiceLabel({
      couponId: stripeCouponId,
      customerPromoCode: discountResolution.customerPromoCode,
      kind: discountResolution.promoKind,
      percentOff: discountResolution.percentOff,
    });
  }

  const returnUrl = `${appUrl}${successReturnPath}${successReturnPath.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;

  const subscriptionMetadata: Record<string, string> = {
    clerkUserId: userId,
    plan,
    period,
  };
  if (discountResolution.affiliateId != null) {
    subscriptionMetadata.affiliateId = String(discountResolution.affiliateId);
  }
  if (discountResolution.customerPromoCode && discountResolution.promoKind) {
    subscriptionMetadata.promoCode = discountResolution.customerPromoCode;
    subscriptionMetadata.promoKind = discountResolution.promoKind;
  }
  if (trialDays != null) {
    subscriptionMetadata.isTrial = "true";
  }

  const checkoutCustomer = await resolveCheckoutCustomerParams(userId);

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...checkoutCustomer,
      ...stripeCheckoutElementsSessionParams(),
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
        ...(trialDays != null ? { trial_period_days: trialDays } : {}),
      },
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      return_url: returnUrl,
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

  if (!session.client_secret) {
    throw new Error("Failed to create checkout session");
  }

  return {
    sessionId: session.id,
    clientSecret: session.client_secret,
  };
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
