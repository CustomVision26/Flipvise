/**
 * applyPlanUpgrade — smart plan application with Stripe proration.
 *
 * If the user has an active Stripe subscription (stored in stripe_subscriptions),
 * swaps the price on that subscription with proration_behavior="always_invoice".
 * Stripe will then:
 *   1. Immediately invoice the prorated difference (credit for unused time + new plan charge).
 *   2. Email the receipt to the customer's email on file.
 *   3. Fire customer.subscription.updated → our webhook updates Clerk metadata.
 *
 * If the user has no active Stripe subscription (complimentary / affiliate grant),
 * falls back to updating Clerk metadata directly via applyAffiliatePlanToClerk().
 */

import { createClerkClient } from "@clerk/backend";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import {
  STRIPE_CLEAR_DISCOUNTS,
  STRIPE_CLEAR_SUBSCRIPTION_DISCOUNTS,
  STRIPE_CLEAR_SUBSCRIPTION_ITEM_DISCOUNTS,
} from "@/lib/stripe-clear-discounts";
import {
  findActiveSubscriptionForClerkUser,
  setStripeBillingState,
  syncActiveSubscriptionFromStripeForUser,
  upsertStripeSubscriptionFromStripeSub,
} from "@/lib/stripe-billing-sync";
import {
  getActiveStripeSubscription,
  getManageableStripeSubscription,
  markStripeSubscriptionStatus,
} from "@/db/queries/stripe-subscriptions";
import { syncRecentStripeInvoicesForUser } from "@/lib/stripe-invoice-persist";
import {
  publicMetadataPatchForAdminPlanAssignment,
  isAdminPlanAssignment,
  type AdminPlanAssignment,
} from "@/lib/admin-assignable-plans";
import {
  ADMIN_PLAN_UPDATED_AT_KEY,
  PLAN_SOURCE_UPDATED_AT_KEY,
  parsePlanSourceUpdatedAtMs,
  resolveEffectivePlan,
} from "@/lib/plan-metadata-billing-resolution";
import { canonicalTeamPlanId, isTeamPlanId } from "@/lib/team-plans";
import { updateOwnedTeamsPlanSlug } from "@/db/queries/teams";
import {
  STRIPE_PAID_PLAN_IDS,
  type StripePaidPlanId,
} from "@/lib/billing-plan-ids";
import { resolveStripePriceIdForPlan } from "@/lib/stripe-plan-price-env";
import { resolveCatalogAlignedStripePriceId } from "@/lib/stripe-catalog-price";
import { readPlansConfigFromDisk } from "@/lib/plans-config-disk";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

function isStripePaidPlan(slug: string): slug is StripePaidPlanId {
  return (STRIPE_PAID_PLAN_IDS as readonly string[]).includes(slug);
}

/** Read the correct price ID env var for a plan + billing period. */
function priceIdForPlanAndPeriod(
  plan: StripePaidPlanId,
  period: "monthly" | "yearly",
): string | null {
  return resolveStripePriceIdForPlan(plan, period);
}

/**
 * Determine the billing period of the existing subscription's first item price.
 * Returns "yearly" when the recurring interval is "year", otherwise "monthly".
 */
async function detectBillingPeriod(
  subscriptionId: string,
): Promise<"monthly" | "yearly"> {
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    });
    const interval = (sub.items?.data?.[0]?.price as { recurring?: { interval?: string } })
      ?.recurring?.interval;
    return interval === "year" ? "yearly" : "monthly";
  } catch {
    return "monthly";
  }
}

/** Update Clerk public metadata directly (complimentary / no-Stripe path). */
async function applyPlanToClerkMetadata(
  userId: string,
  plan: AdminPlanAssignment,
): Promise<void> {
  const target = await clerkClient.users.getUser(userId);
  const existing = target.publicMetadata as Record<string, unknown>;
  const now = new Date().toISOString();

  const patch = publicMetadataPatchForAdminPlanAssignment(plan);
  const merged: Record<string, unknown> = {
    ...existing,
    ...patch,
    [ADMIN_PLAN_UPDATED_AT_KEY]: plan === "free" ? null : now,
    [PLAN_SOURCE_UPDATED_AT_KEY]: plan === "free" ? null : now,
  };

  const resolvedPlan = resolveEffectivePlan(merged);
  const isTeam = resolvedPlan !== null && isTeamPlanId(resolvedPlan);

  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...merged,
      plan: resolvedPlan,
      teamPlanId: isTeam ? resolvedPlan : null,
    } as Record<string, unknown>,
  });

  const canonicalTeam =
    resolvedPlan !== null ? canonicalTeamPlanId(resolvedPlan) : null;
  if (canonicalTeam) {
    await updateOwnedTeamsPlanSlug(userId, canonicalTeam);
  }
}

/**
 * Records an admin plan assignment in Clerk after a Stripe proration swap.
 * Stripe billing metadata alone makes All Users show Plan type = Paid; stamping
 * `adminPlan` (with a timestamp after billing) marks the tier as Assigned.
 */
export async function stampAdminPlanAssignmentMetadata(
  userId: string,
  plan: AdminPlanAssignment,
): Promise<void> {
  if (plan === "free") return;

  const target = await clerkClient.users.getUser(userId);
  const existing = target.publicMetadata as Record<string, unknown>;
  const patch = publicMetadataPatchForAdminPlanAssignment(plan);
  const billingMs =
    parsePlanSourceUpdatedAtMs(existing.billingPlanUpdatedAt) ?? 0;
  const adminAt = new Date(Math.max(Date.now(), billingMs + 1)).toISOString();

  const merged: Record<string, unknown> = {
    ...existing,
    ...patch,
    [ADMIN_PLAN_UPDATED_AT_KEY]: adminAt,
    [PLAN_SOURCE_UPDATED_AT_KEY]: adminAt,
  };

  const resolvedPlan = resolveEffectivePlan(merged);
  const isTeam = resolvedPlan !== null && isTeamPlanId(resolvedPlan);

  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...merged,
      plan: resolvedPlan,
      teamPlanId: isTeam ? resolvedPlan : null,
    } as Record<string, unknown>,
  });

  const canonicalTeam =
    resolvedPlan !== null ? canonicalTeamPlanId(resolvedPlan) : null;
  if (canonicalTeam) {
    await updateOwnedTeamsPlanSlug(userId, canonicalTeam);
  }
}

export type ApplyPlanUpgradeResult =
  | { path: "stripe_proration"; newPriceId: string }
  | { path: "clerk_metadata_only" };

export type ApplyPlanUpgradeOptions = {
  /** Checkout billing toggle; defaults to the existing subscription’s interval. */
  period?: "monthly" | "yearly";
  /** When true (admin plan invite accept), stamp `adminPlan` even on Stripe proration. */
  recordAdminAssignment?: boolean;
};

/** Stripe statuses that allow `subscriptions.update` (price swap / proration). */
const UPDATABLE_STRIPE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
]);

export type UpgradableStripeSubscription = {
  subscriptionId: string;
  customerId: string;
  itemId: string;
  status: string;
};

function upgradableFromStripeSubscription(
  sub: Stripe.Subscription,
  fallbackCustomerId?: string | null,
  fallbackItemId?: string | null,
): UpgradableStripeSubscription | null {
  if (!UPDATABLE_STRIPE_SUBSCRIPTION_STATUSES.has(sub.status)) {
    return null;
  }

  const itemId = sub.items?.data?.[0]?.id ?? fallbackItemId?.trim();
  if (!itemId) return null;

  const customerId =
    typeof sub.customer === "string"
      ? sub.customer
      : (sub.customer?.id ?? fallbackCustomerId ?? null);
  if (!customerId) return null;

  return {
    subscriptionId: sub.id,
    customerId,
    itemId,
    status: sub.status,
  };
}

async function persistUpgradableSubscriptionRow(
  userId: string,
  sub: Stripe.Subscription,
): Promise<void> {
  const planSlug =
    typeof sub.metadata?.plan === "string" && isStripePaidPlan(sub.metadata.plan)
      ? sub.metadata.plan
      : null;
  try {
    await upsertStripeSubscriptionFromStripeSub(userId, sub, planSlug);
  } catch (error) {
    console.error("[fetchUpgradableStripeSubscription] DB upsert:", error);
  }
}

/**
 * Loads the user’s subscription row and confirms with Stripe that it can be updated in place.
 * Falls back to a Stripe API search when the DB row is missing or stale (e.g. webhook lag),
 * so Checkout upgrades in place with proration instead of creating duplicate subscriptions.
 * Returns null when no updatable sub exists so Checkout can start a new subscription.
 */
export async function fetchUpgradableStripeSubscription(
  userId: string,
): Promise<UpgradableStripeSubscription | null> {
  const fromStripeApi = await resolveUpgradableFromStripeApis(userId);
  if (fromStripeApi) return fromStripeApi;

  try {
    const user = await clerkClient.users.getUser(userId);
    const meta = user.publicMetadata as Record<string, unknown>;
    const billingStatus = meta.billingStatus;
    const billingPlan =
      typeof meta.billingPlan === "string" ? meta.billingPlan.trim() : "";
    const clerkPaidActive =
      (billingStatus === "active" || billingStatus === "trialing") &&
      billingPlan.length > 0 &&
      billingPlan !== "free" &&
      isStripePaidPlan(billingPlan);

    if (clerkPaidActive) {
      await syncActiveSubscriptionFromStripeForUser(userId);
      return await resolveUpgradableFromStripeApis(userId);
    }
  } catch (error) {
    console.error("[fetchUpgradableStripeSubscription] clerk sync:", error);
  }

  return null;
}

async function resolveUpgradableFromStripeApis(
  userId: string,
): Promise<UpgradableStripeSubscription | null> {
  const row =
    (await getActiveStripeSubscription(userId)) ??
    (await getManageableStripeSubscription(userId));

  if (row?.stripeSubscriptionId && row.stripeCustomerId) {
    try {
      const sub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId, {
        expand: ["items.data.price"],
      });
      const resolved = upgradableFromStripeSubscription(
        sub,
        row.stripeCustomerId,
        row.stripeSubscriptionItemId,
      );
      if (resolved) return resolved;

      if (sub.status === "canceled" || sub.status === "incomplete_expired") {
        try {
          await markStripeSubscriptionStatus(row.stripeSubscriptionId, sub.status);
        } catch {
          // best-effort — stale DB row
        }
      }
    } catch {
      // DB points at a missing/invalid subscription — fall through to Stripe search.
    }
  }

  const located = await findActiveSubscriptionForClerkUser(userId);
  if (!located) return null;

  let sub = located.sub;
  if (!sub.items?.data?.[0]?.id) {
    try {
      sub = await stripe.subscriptions.retrieve(sub.id, {
        expand: ["items.data.price"],
      });
    } catch {
      return null;
    }
  }

  const resolved = upgradableFromStripeSubscription(sub, located.customerId);
  if (!resolved) return null;

  await persistUpgradableSubscriptionRow(userId, sub);
  return resolved;
}

function priceIdOnSubscriptionItem(
  item: { price?: string | { id?: string } | null } | undefined,
): string | null {
  const p = item?.price;
  if (typeof p === "string") return p;
  if (p && typeof p === "object" && typeof p.id === "string") return p.id;
  return null;
}

/** Ends duplicate active subscriptions on the same Stripe customer (keeps one canonical sub). */
export async function cancelOtherActiveSubscriptionsForCustomer(
  customerId: string,
  keepSubscriptionId: string,
): Promise<void> {
  const listed = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 30,
  });
  for (const sub of listed.data) {
    if (sub.id === keepSubscriptionId) continue;
    if (
      sub.status === "active" ||
      sub.status === "trialing" ||
      sub.status === "past_due"
    ) {
      try {
        await stripe.subscriptions.cancel(sub.id);
      } catch (error) {
        console.error("[cancelOtherActiveSubscriptionsForCustomer]", sub.id, error);
      }
    }
  }
}

async function swapStripeSubscriptionPlan(input: {
  userId: string;
  planSlug: StripePaidPlanId;
  period: "monthly" | "yearly";
  stripeSubscriptionId: string;
  stripeSubscriptionItemId: string;
  stripeCustomerId: string;
}): Promise<string> {
  const plansConfig = await readPlansConfigFromDisk();
  const planRow = plansConfig.find((p) => p.id === input.planSlug);
  const newPriceId = planRow
    ? await resolveCatalogAlignedStripePriceId({
        plan: input.planSlug,
        period: input.period,
        monthlyPrice: planRow.monthlyPrice,
        yearlyMonthlyPrice: planRow.yearlyMonthlyPrice,
      })
    : priceIdForPlanAndPeriod(input.planSlug, input.period);
  if (!newPriceId) {
    throw new Error(
      `No Stripe price configured for plan "${input.planSlug}" (${input.period}).`,
    );
  }

  const current = await stripe.subscriptions.retrieve(input.stripeSubscriptionId, {
    expand: ["items.data.price"],
  });
  if (!UPDATABLE_STRIPE_SUBSCRIPTION_STATUSES.has(current.status)) {
    throw new Error(
      "Your previous subscription has ended. Use checkout to start a new subscription.",
    );
  }
  const currentPriceId = priceIdOnSubscriptionItem(current.items?.data?.[0]);
  const currentPlanMeta = current.metadata?.plan?.trim();
  if (
    currentPriceId === newPriceId &&
    currentPlanMeta === input.planSlug
  ) {
    throw new Error("You are already on this plan.");
  }

  const updated = await stripe.subscriptions.update(input.stripeSubscriptionId, {
    items: [
      {
        id: input.stripeSubscriptionItemId,
        price: newPriceId,
        discounts: STRIPE_CLEAR_SUBSCRIPTION_ITEM_DISCOUNTS,
      },
    ],
    proration_behavior: "always_invoice",
    proration_date: Math.floor(Date.now() / 1000),
    cancel_at_period_end: false,
    discounts: STRIPE_CLEAR_SUBSCRIPTION_DISCOUNTS,
    metadata: {
      ...current.metadata,
      clerkUserId: input.userId,
      plan: input.planSlug,
      period: input.period,
      promoCode: "",
      promoKind: "",
    },
  });

  await cancelOtherActiveSubscriptionsForCustomer(
    input.stripeCustomerId,
    input.stripeSubscriptionId,
  );

  const billingStatus =
    updated.status === "trialing" ? "trialing" : "active";
  await setStripeBillingState(input.userId, input.planSlug, billingStatus);
  await upsertStripeSubscriptionFromStripeSub(
    input.userId,
    updated,
    input.planSlug,
  );

  await stripe.customers.update(input.stripeCustomerId, {
    metadata: { clerkUserId: input.userId, plan: input.planSlug },
  });

  try {
    await syncRecentStripeInvoicesForUser(input.userId, {
      customerId: input.stripeCustomerId,
      limit: 12,
    });
  } catch (error) {
    console.error("[swapStripeSubscriptionPlan] invoice sync:", error);
  }

  return newPriceId;
}

/**
 * Pricing checkout: upgrade an existing paid subscription in place (proration) instead
 * of creating a second Checkout subscription.
 */
export async function tryUpgradeExistingStripeSubscription(input: {
  userId: string;
  planSlug: StripePaidPlanId;
  period: "monthly" | "yearly";
}): Promise<{ upgraded: true; planSlug: StripePaidPlanId } | null> {
  const live = await fetchUpgradableStripeSubscription(input.userId);
  if (!live) return null;

  await swapStripeSubscriptionPlan({
    userId: input.userId,
    planSlug: input.planSlug,
    period: input.period,
    stripeSubscriptionId: live.subscriptionId,
    stripeSubscriptionItemId: live.itemId,
    stripeCustomerId: live.customerId,
  });

  return { upgraded: true, planSlug: input.planSlug };
}

/**
 * Apply a plan change for a user.
 *
 * - If the user has an active Stripe subscription **and** the target plan slug
 *   maps to a Stripe price, swaps the subscription price with proration.
 *   Stripe emails the proration receipt. The webhook updates Clerk metadata.
 *
 * - Otherwise, writes the plan directly to Clerk public metadata (complimentary
 *   / affiliate grant — no Stripe charge).
 *
 * @param userId    Clerk user ID of the recipient.
 * @param planSlug  Target plan slug (e.g. "pro", "pro_team_basic", "free").
 */
export async function applyPlanUpgrade(
  userId: string,
  planSlug: string,
  options?: ApplyPlanUpgradeOptions,
): Promise<ApplyPlanUpgradeResult> {
  const adminPlan = isAdminPlanAssignment(planSlug) ? planSlug : "free";

  if (planSlug !== "free" && isStripePaidPlan(planSlug)) {
    const live = await fetchUpgradableStripeSubscription(userId);
    if (live) {
      const period =
        options?.period ?? (await detectBillingPeriod(live.subscriptionId));
      const newPriceId = await swapStripeSubscriptionPlan({
        userId,
        planSlug,
        period,
        stripeSubscriptionId: live.subscriptionId,
        stripeSubscriptionItemId: live.itemId,
        stripeCustomerId: live.customerId,
      });
      if (options?.recordAdminAssignment && isAdminPlanAssignment(planSlug)) {
        await stampAdminPlanAssignmentMetadata(userId, adminPlan);
      }
      return { path: "stripe_proration", newPriceId };
    }
  }

  await applyPlanToClerkMetadata(userId, adminPlan);
  return { path: "clerk_metadata_only" };
}
