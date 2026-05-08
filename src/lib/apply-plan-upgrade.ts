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
import { getActiveStripeSubscription } from "@/db/queries/stripe-subscriptions";
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
): Promise<ApplyPlanUpgradeResult> {
  const adminPlan = isAdminPlanAssignment(planSlug) ? planSlug : "free";

  // Only attempt Stripe proration when the target is a real paid plan.
  if (planSlug !== "free" && isStripePaidPlan(planSlug)) {
    const existingSub = await getActiveStripeSubscription(userId);

    if (
      existingSub?.stripeSubscriptionId &&
      existingSub?.stripeSubscriptionItemId
    ) {
      const period = await detectBillingPeriod(
        existingSub.stripeSubscriptionId,
      );
      const newPriceId = priceIdForPlanAndPeriod(planSlug, period);

      if (newPriceId) {
        // Swap the price with immediate proration.
        // Stripe fires customer.subscription.updated → webhook updates Clerk.
        await stripe.subscriptions.update(existingSub.stripeSubscriptionId, {
          items: [
            {
              id: existingSub.stripeSubscriptionItemId,
              price: newPriceId,
            },
          ],
          proration_behavior: "create_prorations",
          metadata: {
            clerkUserId: userId,
            plan: planSlug,
          },
        });

        return { path: "stripe_proration", newPriceId };
      }
    }
  }

  // Fallback: complimentary grant or no active Stripe subscription.
  await applyPlanToClerkMetadata(userId, adminPlan);
  return { path: "clerk_metadata_only" };
}
