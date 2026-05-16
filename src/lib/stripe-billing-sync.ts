import { createClerkClient } from "@clerk/backend";
import type Stripe from "stripe";
import { upsertStripeSubscription } from "@/db/queries/stripe-subscriptions";
import { updateOwnedTeamsPlanSlug } from "@/db/queries/teams";
import {
  BILLING_PLAN_KEY,
  BILLING_STATUS_KEY,
  BILLING_PLAN_UPDATED_AT_KEY,
  resolveEffectivePlan,
  type BillingStatusValue,
} from "@/lib/plan-metadata-billing-resolution";
import {
  STRIPE_PAID_PLAN_IDS,
  type StripePaidPlanId,
} from "@/lib/billing-plan-ids";
import { stripe } from "@/lib/stripe";
import { canonicalTeamPlanId, isTeamPlanId } from "@/lib/team-plans";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export function asPaidPlanId(value: unknown): StripePaidPlanId | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if ((STRIPE_PAID_PLAN_IDS as readonly string[]).includes(trimmed)) {
    return trimmed as StripePaidPlanId;
  }
  const canonTeam = canonicalTeamPlanId(trimmed);
  return canonTeam ?? null;
}

/**
 * Writes Stripe-sourced billing fields to Clerk public metadata, then recomputes `plan`.
 */
export async function setStripeBillingState(
  userId: string,
  plan: StripePaidPlanId | null,
  status: BillingStatusValue,
) {
  const user = await clerkClient.users.getUser(userId);
  const now = new Date().toISOString();
  const existing = user.publicMetadata as Record<string, unknown>;

  const updated: Record<string, unknown> = {
    ...existing,
    [BILLING_PLAN_KEY]: plan,
    [BILLING_STATUS_KEY]: status,
    [BILLING_PLAN_UPDATED_AT_KEY]: now,
  };

  const resolvedPlan = resolveEffectivePlan(updated);
  const isTeamPlan = resolvedPlan !== null && isTeamPlanId(resolvedPlan);

  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...updated,
      plan: resolvedPlan,
      teamPlanId: isTeamPlan ? resolvedPlan : null,
    },
  });

  try {
    const canonicalTeam =
      resolvedPlan !== null ? canonicalTeamPlanId(resolvedPlan) : null;
    if (canonicalTeam) {
      await updateOwnedTeamsPlanSlug(userId, canonicalTeam);
    }
  } catch {
    // Best-effort
  }
}

export async function upsertStripeSubscriptionFromStripeSub(
  userId: string,
  sub: Stripe.Subscription,
  planSlug: StripePaidPlanId | null,
) {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return;

  const firstItem = sub.items?.data?.[0];
  const firstItemAny = firstItem as unknown as { current_period_end?: number };

  await upsertStripeSubscription({
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    stripeSubscriptionItemId: firstItem?.id ?? null,
    planSlug,
    status: sub.status,
    currentPeriodEnd:
      typeof firstItemAny?.current_period_end === "number"
        ? new Date(firstItemAny.current_period_end * 1000)
        : null,
  });
}

function billingStatusFromStripeSubscription(
  status: Stripe.Subscription.Status,
): BillingStatusValue {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "canceled") return "canceled";
  return "expired";
}

/**
 * Pulls the user's active/trialing Stripe subscription and syncs Clerk + DB.
 * Used when webhooks did not reach the app (common in local dev).
 */
export async function syncActiveSubscriptionFromStripeForUser(
  userId: string,
): Promise<{ synced: boolean; planSlug: StripePaidPlanId | null }> {
  const customers = await stripe.customers.search({
    query: `metadata['clerkUserId']:'${userId}'`,
    limit: 1,
  });
  const customerId = customers.data[0]?.id;
  if (!customerId) {
    return { synced: false, planSlug: null };
  }

  const listed = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
  });

  const sub = listed.data.find(
    (s) => s.status === "active" || s.status === "trialing",
  );
  if (!sub) {
    return { synced: false, planSlug: null };
  }

  const customer = await stripe.customers.retrieve(customerId);
  const customerPlan =
    !customer.deleted && customer.metadata?.plan
      ? asPaidPlanId(customer.metadata.plan)
      : null;

  const plan =
    asPaidPlanId(sub.metadata?.plan) ?? customerPlan ?? ("pro" as const);
  const billingStatus = billingStatusFromStripeSubscription(sub.status);

  await setStripeBillingState(userId, plan, billingStatus);
  await upsertStripeSubscriptionFromStripeSub(userId, sub, plan);

  if (!customer.deleted) {
    await stripe.customers.update(customerId, {
      metadata: { clerkUserId: userId, plan },
    });
  }

  return { synced: true, planSlug: plan };
}
