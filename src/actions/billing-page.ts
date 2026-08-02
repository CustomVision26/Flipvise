"use server";

import { auth as clerkAuth } from "@clerk/nextjs/server";
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
import {
  syncActiveSubscriptionFromStripeForUser,
  syncBillingFromCheckoutSession,
} from "@/lib/stripe-billing-sync";
import { syncBillingInvoicesForUser, syncCheckoutSessionInvoicesForUser } from "@/lib/stripe-invoice-persist";
import { recordSubscriptionCheckoutInboxForSession } from "@/lib/record-subscription-checkout-inbox";
import { resolveLatestBillingReceiptForUser } from "@/lib/billing-receipt-url";
import { isStripeCheckoutSessionId } from "@/lib/stripe-checkout-session-id";
import { getAccessContext } from "@/lib/access";
import type { StripePaidPlanId } from "@/lib/billing-plan-ids";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import {
  fetchCancelSubscriptionPreview,
  type CancelSubscriptionPreview,
} from "@/lib/stripe-cancel-subscription";
import type { PlanHistoryRow } from "@/lib/plan-history-types";
import { stripe } from "@/lib/stripe";
import {
  getAddonCatalogByKey,
  listActiveUserAddonEntitlements,
} from "@/db/queries/addons";
import { syncAddonEntitlementsFromStripeSubscription } from "@/lib/stripe-addon-sync";

export type BillingCancelAddonOption = {
  addonKey: string;
  label: string;
  cancelAtPeriodEnd: boolean;
  periodEnd: string | null;
};

export type BillingTabData = {
  planHistory: PlanHistoryRow[];
  canCancelStripe: boolean;
  cancelPreview: CancelSubscriptionPreview | null;
  /** Active Stripe-billed add-ons eligible for renewal cancel from Billing. */
  cancelableAddons: BillingCancelAddonOption[];
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
    const { userId } = await clerkAuth();
    if (!userId) {
      return {
        planHistory: [],
        canCancelStripe: false,
        cancelPreview: null,
        cancelableAddons: [],
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
          { clerkUserId: userId },
        );
      } catch (error) {
        console.error("[billing-page] cancel preview:", error);
      }
    }

    const cancelableAddons: BillingCancelAddonOption[] = [];
    try {
      const entitlements = await listActiveUserAddonEntitlements(userId);
      for (const row of entitlements) {
        if (row.source !== "stripe" || !row.stripeSubscriptionId) continue;
        let label = row.addonKey;
        try {
          const catalog = await getAddonCatalogByKey(row.addonKey);
          if (catalog?.name?.trim()) label = catalog.name.trim();
        } catch {
          // keep key
        }
        let cancelAtPeriodEnd = false;
        let periodEnd: string | null = null;
        try {
          const addonSub = await stripe.subscriptions.retrieve(
            row.stripeSubscriptionId,
          );
          cancelAtPeriodEnd = addonSub.cancel_at_period_end === true;
          const item = addonSub.items.data[0] as
            | { current_period_end?: number }
            | undefined;
          if (typeof item?.current_period_end === "number") {
            periodEnd = new Date(item.current_period_end * 1000).toISOString();
          }
        } catch (error) {
          console.error(
            "[billing-page] addon cancel preview:",
            row.addonKey,
            error,
          );
        }
        cancelableAddons.push({
          addonKey: row.addonKey,
          label,
          cancelAtPeriodEnd,
          periodEnd,
        });
      }
    } catch (error) {
      console.error("[billing-page] cancelable addons:", error);
    }

    return {
      planHistory,
      canCancelStripe: sub != null && planDisplay.showPaidStripeControls,
      cancelPreview,
      cancelableAddons,
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
      cancelableAddons: [],
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

/** Re-sync invoices from Stripe and return fresh plan history (post-checkout / billing tab). */
export async function refreshBillingPlanHistoryAction(): Promise<PlanHistoryRow[]> {
  const { userId } = await clerkAuth();
  if (!userId) return [];

  const email = await resolveUserEmail(userId);

  try {
    await syncActiveSubscriptionFromStripeForUser(userId);
  } catch (error) {
    console.error("[refreshBillingPlanHistoryAction] subscription sync:", error);
  }

  try {
    await syncBillingInvoicesForUser(userId);
  } catch (error) {
    console.error("[refreshBillingPlanHistoryAction] invoice sync:", error);
  }

  const planHistory = await getMergedPlanHistoryForUser(userId, email);
  planHistory.sort(
    (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime(),
  );
  return planHistory;
}

const syncBillingAfterCheckoutSchema = z.object({
  checkoutSessionId: z.string().max(256).optional(),
});

const emptyCheckoutSyncResult = {
  synced: false,
  planSlug: null,
  planLabel: null,
  receiptUrl: null,
  receiptIsProration: false,
  checkoutKind: "plan" as const,
};

export async function syncBillingAfterCheckoutAction(
  data: z.infer<typeof syncBillingAfterCheckoutSchema> = {},
): Promise<{
  synced: boolean;
  planSlug: string | null;
  planLabel: string | null;
  receiptUrl: string | null;
  receiptIsProration: boolean;
  checkoutKind: "plan" | "addon";
}> {
  const parsed = syncBillingAfterCheckoutSchema.safeParse(data);
  if (!parsed.success) {
    return { ...emptyCheckoutSyncResult };
  }

  const { userId } = await clerkAuth();
  if (!userId) {
    return { ...emptyCheckoutSyncResult };
  }

  const email = await resolveUserEmail(userId);
  const checkoutSessionId = parsed.data.checkoutSessionId?.trim() ?? "";

  let result: { synced: boolean; planSlug: StripePaidPlanId | null } = {
    synced: false,
    planSlug: null,
  };

  let preferAddon = false;
  let addonKey: string | null = null;
  let addonSynced = false;

  if (isStripeCheckoutSessionId(checkoutSessionId)) {
    result = await syncBillingFromCheckoutSession(userId, checkoutSessionId);
    try {
      await syncCheckoutSessionInvoicesForUser(userId, checkoutSessionId);
    } catch (error) {
      console.error("[syncBillingAfterCheckoutAction] checkout session:", error);
    }
    try {
      const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
        expand: ["subscription"],
      });
      preferAddon = session.metadata?.type === "addon";
      addonKey = session.metadata?.addonKey?.trim() || null;

      if (preferAddon) {
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ["items.data"],
          });
          await syncAddonEntitlementsFromStripeSubscription(sub, userId);
          addonSynced = true;
        }
      }
    } catch (error) {
      console.error(
        "[syncBillingAfterCheckoutAction] session metadata / addon sync:",
        error,
      );
    }
  }

  if (!result.synced) {
    result = await syncActiveSubscriptionFromStripeForUser(userId);
  }

  try {
    await syncBillingInvoicesForUser(userId);
  } catch (error) {
    console.error("[syncBillingAfterCheckoutAction] invoice sync:", error);
  }

  let receipt = {
    receiptUrl: null as string | null,
    isProration: false,
  };
  try {
    receipt = await resolveLatestBillingReceiptForUser(userId, email, {
      preferAddon,
      addonKey,
    });
  } catch (error) {
    console.error("[syncBillingAfterCheckoutAction] receipt resolve:", error);
  }

  let planLabel: string | null =
    result.planSlug != null
      ? displayNameForBillingPlanSlug(result.planSlug)
      : null;

  if (preferAddon && addonKey) {
    try {
      const catalog = await getAddonCatalogByKey(addonKey);
      if (catalog?.name) planLabel = catalog.name;
    } catch (error) {
      console.error("[syncBillingAfterCheckoutAction] addon catalog:", error);
    }
  }

  try {
    await refreshBillingPlanHistoryAction();
  } catch (error) {
    console.error("[syncBillingAfterCheckoutAction] plan history refresh:", error);
  }

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
    synced: preferAddon ? addonSynced || result.synced || Boolean(planLabel) : result.synced,
    planSlug: result.planSlug,
    planLabel,
    receiptUrl: receipt.receiptUrl,
    receiptIsProration: receipt.isProration,
    checkoutKind: preferAddon ? "addon" : "plan",
  };
}
