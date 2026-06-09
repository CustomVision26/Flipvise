"use server";

import { auth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import {
  appendComplimentaryAccessHistoryRows,
  getMergedPlanHistoryForUser,
} from "@/db/queries/plan-history";
import { resolveBillingTabPlanDisplay } from "@/lib/billing-tab-plan-display";
import {
  getActiveStripeSubscription,
  getManageableStripeSubscription,
} from "@/db/queries/stripe-subscriptions";
import { syncActiveSubscriptionFromStripeForUser } from "@/lib/stripe-billing-sync";
import { syncRecentStripeInvoicesForUser } from "@/lib/stripe-invoice-persist";
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
      await syncRecentStripeInvoicesForUser(userId);
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

    const planHistory = await getMergedPlanHistoryForUser(userId, email);
    await appendComplimentaryAccessHistoryRows(userId, planHistory, meta);
    planHistory.sort(
      (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
    );

    const planDisplay = resolveBillingTabPlanDisplay({
      meta,
      stripePlanSlug: activeSub?.planSlug?.trim() || null,
      billingStatus,
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
      canCancelStripe: sub != null,
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
export async function syncBillingAfterCheckoutAction(): Promise<{
  synced: boolean;
  planSlug: string | null;
  planLabel: string | null;
}> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const result = await syncActiveSubscriptionFromStripeForUser(userId);
  try {
    await syncRecentStripeInvoicesForUser(userId);
  } catch (error) {
    console.error("[syncBillingAfterCheckoutAction] invoice sync:", error);
  }
  const planLabel =
    result.planSlug != null
      ? displayNameForBillingPlanSlug(result.planSlug)
      : null;

  return {
    synced: result.synced,
    planSlug: result.planSlug,
    planLabel,
  };
}
