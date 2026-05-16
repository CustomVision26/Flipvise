/**
 * applyPlanUpgrade — smart plan application with Stripe proration.
 *
 * If the user has an active Stripe subscription (stored in stripe_subscriptions),
 * swaps the price on that subscription with proration_behavior="create_prorations".
 * Stripe will then:
 *   1. Immediately invoice the prorated difference.
 *   2. Email the receipt to the customer's email on file.
 *   3. Fire customer.subscription.updated → our webhook updates Clerk metadata.
 *
 * If the user has no active Stripe subscription (complimentary / affiliate grant),
 * falls back to updating Clerk metadata directly via applyAffiliatePlanToClerk().
 */

import { createClerkClient } from "@clerk/backend";
import { stripe } from "@/lib/stripe";
import {
  getActiveStripeSubscription,
  getManageableStripeSubscription,
  markStripeSubscriptionStatus,
} from "@/db/queries/stripe-subscriptions";
import {
  setStripeBillingState,
  upsertStripeSubscriptionFromStripeSub,
} from "@/lib/stripe-billing-sync";
import {
  publicMetadataPatchForAdminPlanAssignment,
  isAdminPlanAssignment,
  type AdminPlanAssignment,
} from "@/lib/admin-assignable-plans";
import {
  ADMIN_PLAN_UPDATED_AT_KEY,
  PLAN_SOURCE_UPDATED_AT_KEY,
  resolveEffectivePlan,
} from "@/lib/plan-metadata-billing-resolution";
import { canonicalTeamPlanId, isTeamPlanId } from "@/lib/team-plans";
import { updateOwnedTeamsPlanSlug } from "@/db/queries/teams";
import {
  STRIPE_PAID_PLAN_IDS,
  type StripePaidPlanId,
} from "@/lib/billing-plan-ids";
import { resolveStripePriceIdForPlan } from "@/lib/stripe-plan-price-env";

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

export type ApplyPlanUpgradeResult =
  | { path: "stripe_proration"; newPriceId: string }
  | { path: "clerk_metadata_only" };

export type ApplyPlanUpgradeOptions = {
  /** Checkout billing toggle; defaults to the existing subscription’s interval. */
  period?: "monthly" | "yearly";
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

/**
 * Loads the user’s subscription row and confirms with Stripe that it can be updated in place.
 * Returns null when the sub is canceled (or missing) so Checkout can start a new subscription.
 */
export async function fetchUpgradableStripeSubscription(
  userId: string,
): Promise<UpgradableStripeSubscription | null> {
  const row =
    (await getActiveStripeSubscription(userId)) ??
    (await getManageableStripeSubscription(userId));

  if (!row?.stripeSubscriptionId || !row.stripeCustomerId) {
    return null;
  }

  let sub;
  try {
    sub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId, {
      expand: ["items.data.price"],
    });
  } catch {
    return null;
  }

  if (!UPDATABLE_STRIPE_SUBSCRIPTION_STATUSES.has(sub.status)) {
    if (sub.status === "canceled" || sub.status === "incomplete_expired") {
      try {
        await markStripeSubscriptionStatus(row.stripeSubscriptionId, sub.status);
      } catch {
        // best-effort — stale DB row
      }
    }
    return null;
  }

  const itemId = sub.items?.data?.[0]?.id ?? row.stripeSubscriptionItemId?.trim();
  if (!itemId) return null;

  const customerId =
    typeof sub.customer === "string"
      ? sub.customer
      : (sub.customer?.id ?? row.stripeCustomerId);

  return {
    subscriptionId: row.stripeSubscriptionId,
    customerId,
    itemId,
    status: sub.status,
  };
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
async function cancelOtherActiveSubscriptionsForCustomer(
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
  const newPriceId = priceIdForPlanAndPeriod(input.planSlug, input.period);
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
    items: [{ id: input.stripeSubscriptionItemId, price: newPriceId }],
    proration_behavior: "create_prorations",
    cancel_at_period_end: false,
    metadata: {
      clerkUserId: input.userId,
      plan: input.planSlug,
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
      return { path: "stripe_proration", newPriceId };
    }
  }

  await applyPlanToClerkMetadata(userId, adminPlan);
  return { path: "clerk_metadata_only" };
}
