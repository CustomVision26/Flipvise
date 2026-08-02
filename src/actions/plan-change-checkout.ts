"use server";

import { z } from "zod";
import { auth } from "@/lib/clerk-auth";
import { STRIPE_PAID_PLAN_IDS, type StripePaidPlanId } from "@/lib/billing-plan-ids";
import { isEducationPlanId } from "@/lib/education-plans";
import {
  fetchUpgradableStripeSubscription,
  tryUpgradeExistingStripeSubscription,
} from "@/lib/apply-plan-upgrade";
import { getClerkUserFieldDisplayById } from "@/lib/clerk-user-display";
import { resolveLatestBillingReceiptForUser } from "@/lib/billing-receipt-url";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import {
  resolvePlanChangeSelectedAddonLine,
  type PlanChangeSelectedAddonLine,
} from "@/lib/plan-change-locked-addons";
import {
  fetchPlanChangeProrationPreview,
  resolvePlanChangeCheckoutContext,
  type PlanChangeCheckoutContext,
  type PlanChangeProrationPreview,
} from "@/lib/plan-change-proration-preview";
import { syncRecentStripeInvoicesForUser } from "@/lib/stripe-invoice-persist";
import { personalDashboardHrefAfterPlanChangeSuccess } from "@/lib/personal-dashboard-url";
import { recordPlanChangeCheckoutInboxConfirmation } from "@/lib/record-subscription-checkout-inbox";
import { stripe, resolveAppUrl } from "@/lib/stripe";
import { isStripeSetupIntentId } from "@/lib/stripe-checkout-session-id";
import { asPaidPlanId } from "@/lib/stripe-billing-sync";
import {
  resolveStripePriceIdForPlan,
  stripePriceEnvPairForPlan,
} from "@/lib/stripe-plan-price-env";

const planChangeSchema = z.object({
  plan: z.enum(STRIPE_PAID_PLAN_IDS),
  period: z.enum(["monthly", "yearly"]),
  /** Optional locked add-on to checkout immediately after plan change succeeds. */
  addonKey: z.string().min(1).max(128).optional(),
});

const planChangeFinalizeSchema = z.object({
  setupIntentId: z.string().max(256).optional(),
});

export type PlanChangeCheckoutContextResult = PlanChangeCheckoutContext & {
  initialPreview: PlanChangeProrationPreview | null;
};

function assertPlanChangeTargetPriceConfigured(
  plan: StripePaidPlanId,
  period: "monthly" | "yearly",
): void {
  const priceId = resolveStripePriceIdForPlan(plan, period);
  if (priceId) return;

  const envKey = stripePriceEnvPairForPlan(plan, period).primary;
  if (isEducationPlanId(plan)) {
    throw new Error(
      `Education plan checkout is not configured yet (${envKey}). Please contact support and we will help you upgrade.`,
    );
  }
  throw new Error(
    `This plan is not available for checkout right now (${envKey}). Please contact support.`,
  );
}

export async function validatePlanChangeTargetPriceAction(
  data: z.infer<typeof planChangeSchema>,
): Promise<void> {
  const parsed = planChangeSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const live = await fetchUpgradableStripeSubscription(userId);
  if (!live) {
    throw new Error(
      "No active subscription found to change. Start a new subscription from the pricing page.",
    );
  }

  assertPlanChangeTargetPriceConfigured(parsed.data.plan, parsed.data.period);
}

export async function getPlanChangeCheckoutContextAction(
  data: z.infer<typeof planChangeSchema>,
): Promise<PlanChangeCheckoutContextResult | null> {
  const parsed = planChangeSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const context = await resolvePlanChangeCheckoutContext(
    userId,
    parsed.data.plan,
  );
  if (!context) return null;

  const initialPreview = await fetchPlanChangeProrationPreview({
    userId,
    planSlug: parsed.data.plan,
    period: parsed.data.period,
  });

  return { ...context, initialPreview };
}

export async function getPlanChangeProrationPreviewAction(
  data: z.infer<typeof planChangeSchema>,
): Promise<PlanChangeProrationPreview | null> {
  const parsed = planChangeSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return fetchPlanChangeProrationPreview({
    userId,
    planSlug: parsed.data.plan,
    period: parsed.data.period,
  });
}

const planChangeAddonPreviewSchema = z.object({
  addonKey: z.string().min(1).max(128),
  period: z.enum(["monthly", "yearly"]),
});

/** Prorated (when aligned) add-on first-charge preview for plan-change dialog. */
export async function getPlanChangeSelectedAddonLineAction(
  data: z.infer<typeof planChangeAddonPreviewSchema>,
): Promise<PlanChangeSelectedAddonLine | null> {
  const parsed = planChangeAddonPreviewSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return resolvePlanChangeSelectedAddonLine({
    userId,
    addonKey: parsed.data.addonKey,
    period: parsed.data.period,
  });
}

/** Pay page: save / confirm payment method before applying prorated plan swap. */
export async function createPlanChangeSetupIntentAction(
  data: z.infer<typeof planChangeSchema>,
): Promise<{ clientSecret: string; returnUrl: string }> {
  const parsed = planChangeSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const { plan, period, addonKey } = parsed.data;
  assertPlanChangeTargetPriceConfigured(plan, period);

  const live = await fetchUpgradableStripeSubscription(userId);
  if (!live) {
    throw new Error(
      "No active subscription found to change. Start a new subscription from the pricing page.",
    );
  }

  const pendingAddonKey = addonKey?.trim() || "";

  const setupIntent = await stripe.setupIntents.create({
    customer: live.customerId,
    payment_method_types: ["card"],
    usage: "off_session",
    metadata: {
      clerkUserId: userId,
      checkoutKind: "plan_change",
      plan,
      period,
      subscriptionId: live.subscriptionId,
      subscriptionItemId: live.itemId,
      ...(pendingAddonKey ? { pendingAddonKey } : {}),
    },
  });

  if (!setupIntent.client_secret) {
    throw new Error("Failed to prepare payment method confirmation.");
  }

  const appUrl = resolveAppUrl();
  if (pendingAddonKey) {
    const continueParams = new URLSearchParams({
      plan,
      period,
      addon: pendingAddonKey,
    });
    return {
      clientSecret: setupIntent.client_secret,
      returnUrl: `${appUrl}/pricing/checkout/plan-change/continue?${continueParams.toString()}`,
    };
  }

  const returnUrl = `${appUrl}${personalDashboardHrefAfterPlanChangeSuccess({
    userId,
    purchasedPlanSlug: plan,
  })}`;

  return { clientSecret: setupIntent.client_secret, returnUrl };
}

/** After SetupIntent redirect — swap plan with proration (no promo carry-over). */
export async function finalizePlanChangePaymentAction(
  data: z.infer<typeof planChangeFinalizeSchema> = {},
): Promise<{
  synced: boolean;
  planSlug: string | null;
  planLabel: string | null;
  receiptUrl: string | null;
  receiptIsProration: boolean;
}> {
  const parsed = planChangeFinalizeSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const setupIntentId = parsed.data.setupIntentId?.trim() ?? "";
  if (!isStripeSetupIntentId(setupIntentId)) {
    return {
      synced: false,
      planSlug: null,
      planLabel: null,
      receiptUrl: null,
      receiptIsProration: false,
    };
  }

  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
  if (setupIntent.metadata?.checkoutKind !== "plan_change") {
    return {
      synced: false,
      planSlug: null,
      planLabel: null,
      receiptUrl: null,
      receiptIsProration: false,
    };
  }
  if (setupIntent.metadata?.clerkUserId?.trim() !== userId) {
    throw new Error("Unauthorized");
  }
  if (setupIntent.status !== "succeeded") {
    throw new Error("Payment method confirmation was not completed.");
  }

  const plan = asPaidPlanId(setupIntent.metadata?.plan);
  const period =
    setupIntent.metadata?.period === "yearly" ? "yearly" : "monthly";
  if (!plan) {
    throw new Error("Invalid plan on payment confirmation.");
  }

  const upgraded = await tryUpgradeExistingStripeSubscription({
    userId,
    planSlug: plan,
    period,
  });
  if (!upgraded) {
    throw new Error("Could not update your subscription. Please contact support.");
  }

  const live = await fetchUpgradableStripeSubscription(userId);
  if (live?.customerId) {
    try {
      await syncRecentStripeInvoicesForUser(userId, {
        customerId: live.customerId,
        limit: 12,
      });
    } catch (error) {
      console.error("[finalizePlanChangePaymentAction] invoice sync:", error);
    }
  }

  const { primaryEmail } = await getClerkUserFieldDisplayById(userId);
  const receipt = await resolveLatestBillingReceiptForUser(
    userId,
    primaryEmail?.trim().toLowerCase() ?? null,
    { preferAddon: false },
  );

  const planLabel = displayNameForBillingPlanSlug(plan);
  try {
    await recordPlanChangeCheckoutInboxConfirmation({
      userId,
      setupIntentId,
      planSlug: plan,
      planLabel,
      period,
      receiptUrl: receipt.receiptUrl,
    });
  } catch (error) {
    console.error(
      "[finalizePlanChangePaymentAction] subscription inbox:",
      error,
    );
  }

  return {
    synced: true,
    planSlug: plan,
    planLabel,
    receiptUrl: receipt.receiptUrl,
    receiptIsProration: true,
  };
}
