"use server";

import { auth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { z } from "zod";
import {
  appendComplimentaryAccessHistoryRows,
  getMergedPlanHistoryForUser,
} from "@/db/queries/plan-history";
import {
  resolveActiveAffiliateGrant,
  resolveBillingTabPlanDisplay,
} from "@/lib/billing-tab-plan-display";
import { listAffiliatesForPlanHistory } from "@/db/queries/affiliates";
import {
  getActiveStripeSubscription,
  getManageableStripeSubscription,
} from "@/db/queries/stripe-subscriptions";
import { syncActiveSubscriptionFromStripeForUser } from "@/lib/stripe-billing-sync";
import { syncBillingInvoicesForUser, syncCheckoutSessionInvoicesForUser } from "@/lib/stripe-invoice-persist";
import { recordSubscriptionCheckoutInboxForSession } from "@/lib/record-subscription-checkout-inbox";
import { resolveLatestBillingReceiptForUser } from "@/lib/billing-receipt-url";
import { isStripeCheckoutSessionId } from "@/lib/stripe-checkout-session-id";
import { getAccessContext } from "@/lib/access";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import {
  fetchCancelSubscriptionPreview,
  type CancelSubscriptionPreview,
} from "@/lib/stripe-cancel-subscription";
import type { PlanHistoryRow } from "@/lib/plan-history-types";

export type BillingTabData = {
  planHistory: PlanHistoryRow[];
  canCancelStripe: boolean;
  cancelPreview: CancelSubscriptionPreview | null;
  /** Resolved current plan slug (Stripe, metadata, or complimentary unlock). */
  currentPlanSlug: string | null;
  planLabel: string;
  billingStatus: string | null;
  adminRoleLabel: string | null;
  isComplimentary: boolean;
  accessSubtitle: string;
  showPaidStripeControls: boolean;
};

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

async function resolveUserEmail(userId: string): Promise<string | null> {
  if (!process.env.CLERK_SECRET_KEY) return null;
  try {
    const user = await clerkClient.users.getUser(userId);
    const primary = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId,
    )?.emailAddress;
    const fallback = user.emailAddresses[0]?.emailAddress;
    return (primary ?? fallback)?.toLowerCase() ?? null;
  } catch (error) {
    console.error("[billing-page] resolveUserEmail:", error);
    return null;
  }
}

/** Single billing-tab fetch: plan history + cancel eligibility (avoids action spam). */
export async function loadBillingTabDataAction(): Promise<BillingTabData> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return {
        planHistory: [],
        canCancelStripe: false,
        cancelPreview: null,
        currentPlanSlug: null,
        planLabel: "Free",
        billingStatus: null,
        adminRoleLabel: null,
        isComplimentary: false,
        accessSubtitle: "No active subscription",
        showPaidStripeControls: false,
      };
    }

    const email = await resolveUserEmail(userId);

    try {
      await syncActiveSubscriptionFromStripeForUser(userId);
    } catch (error) {
      console.error("[loadBillingTabDataAction] subscription sync:", error);
    }

    try {
      await syncBillingInvoicesForUser(userId);
    } catch (error) {
      console.error("[loadBillingTabDataAction] invoice sync:", error);
    }

    const activeSub =
      (await getActiveStripeSubscription(userId)) ??
      (await getManageableStripeSubscription(userId));
    const sub = activeSub;

    let meta: Record<string, unknown> = {};
    let billingStatus: string | null = null;
    try {
      const user = await clerkClient.users.getUser(userId);
      meta = (user.publicMetadata ?? {}) as Record<string, unknown>;
      const raw = meta.billingStatus;
      billingStatus = typeof raw === "string" ? raw : null;
    } catch {
      // omit
    }

    if (!billingStatus && activeSub?.status) {
      billingStatus = activeSub.status;
    }

    const [planHistory, affiliateRows] = await Promise.all([
      getMergedPlanHistoryForUser(userId, email),
      listAffiliatesForPlanHistory(userId, email),
    ]);
    await appendComplimentaryAccessHistoryRows(userId, planHistory, meta);
    planHistory.sort(
      (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
    );

    const activeAffiliateGrant = resolveActiveAffiliateGrant(affiliateRows);
    const accessCtx = await getAccessContext();

    const planDisplay = resolveBillingTabPlanDisplay({
      meta,
      stripePlanSlug: activeSub?.planSlug?.trim() || null,
      billingStatus,
      activeAffiliateGrant,
      platformAdminUnlocked: accessCtx.isAdmin,
    });

    let cancelPreview: CancelSubscriptionPreview | null = null;
    if (sub) {
      try {
        cancelPreview = await fetchCancelSubscriptionPreview(
          sub.stripeSubscriptionId,
          sub.planSlug,
        );
      } catch (error) {
        console.error("[billing-page] cancel preview:", error);
      }
    }

    return {
      planHistory,
      canCancelStripe: sub != null && planDisplay.showPaidStripeControls,
      cancelPreview,
      currentPlanSlug: planDisplay.planSlug,
      planLabel: planDisplay.planLabel,
      billingStatus: planDisplay.billingStatus,
      adminRoleLabel: planDisplay.adminRoleLabel,
      isComplimentary: planDisplay.isComplimentary,
      accessSubtitle: planDisplay.accessSubtitle,
      showPaidStripeControls: planDisplay.showPaidStripeControls,
    };
  } catch (error) {
    console.error("[loadBillingTabDataAction]", error);
    return {
      planHistory: [],
      canCancelStripe: false,
      cancelPreview: null,
      currentPlanSlug: null,
      planLabel: "Free",
      billingStatus: null,
      adminRoleLabel: null,
      isComplimentary: false,
      accessSubtitle: "No active subscription",
      showPaidStripeControls: false,
    };
  }
}

/** After Checkout redirect when webhooks did not run (e.g. local `stripe listen` missing). */
const syncBillingAfterCheckoutSchema = z.object({
  checkoutSessionId: z.string().max(256).optional(),
});

export async function syncBillingAfterCheckoutAction(
  data: z.infer<typeof syncBillingAfterCheckoutSchema> = {},
): Promise<{
  synced: boolean;
  planSlug: string | null;
  planLabel: string | null;
  receiptUrl: string | null;
  receiptIsProration: boolean;
}> {
  const parsed = syncBillingAfterCheckoutSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const email = await resolveUserEmail(userId);
  const checkoutSessionId = parsed.data.checkoutSessionId?.trim() ?? "";

  if (isStripeCheckoutSessionId(checkoutSessionId)) {
    try {
      await syncCheckoutSessionInvoicesForUser(userId, checkoutSessionId);
    } catch (error) {
      console.error("[syncBillingAfterCheckoutAction] checkout session:", error);
    }
  }

  const result = await syncActiveSubscriptionFromStripeForUser(userId);
  try {
    await syncBillingInvoicesForUser(userId);
  } catch (error) {
    console.error("[syncBillingAfterCheckoutAction] invoice sync:", error);
  }

  const receipt = await resolveLatestBillingReceiptForUser(userId, email);
  const planLabel =
    result.planSlug != null
      ? displayNameForBillingPlanSlug(result.planSlug)
      : null;

  if (isStripeCheckoutSessionId(checkoutSessionId)) {
    try {
      await recordSubscriptionCheckoutInboxForSession(userId, checkoutSessionId, {
        receiptUrl: receipt.receiptUrl,
      });
    } catch (error) {
      console.error("[syncBillingAfterCheckoutAction] subscription inbox:", error);
    }
  }

  return {
    synced: result.synced,
    planSlug: result.planSlug,
    planLabel,
    receiptUrl: receipt.receiptUrl,
    receiptIsProration: receipt.isProration,
  };
}
