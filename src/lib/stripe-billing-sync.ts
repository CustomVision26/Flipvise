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

function stripeSearchLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function resolveClerkPrimaryEmail(userId: string): Promise<string | null> {
  try {
    const user = await clerkClient.users.getUser(userId);
    const primary =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
    const normalized = primary?.trim().toLowerCase();
    return normalized || null;
  } catch {
    return null;
  }
}

/**
 * Locates an active/trialing subscription for a Clerk user when webhooks did not run.
 * Subscription metadata is checked first — Checkout always sets `clerkUserId` there,
 * even before customer metadata is patched.
 */
async function findActiveSubscriptionForClerkUser(userId: string): Promise<{
  sub: Stripe.Subscription;
  customerId: string;
} | null> {
  const uid = stripeSearchLiteral(userId);

  try {
    const bySubMeta = await stripe.subscriptions.search({
      query: `metadata['clerkUserId']:'${uid}' AND (status:'active' OR status:'trialing')`,
      limit: 1,
    });
    const subFromMeta = bySubMeta.data[0];
    if (subFromMeta) {
      const customerId =
        typeof subFromMeta.customer === "string"
          ? subFromMeta.customer
          : subFromMeta.customer?.id;
      if (customerId) return { sub: subFromMeta, customerId };
    }
  } catch {
    // Subscription Search may be unavailable; fall through to customer lookup.
  }

  let customerId: string | undefined;

  const customers = await stripe.customers.search({
    query: `metadata['clerkUserId']:'${uid}'`,
    limit: 1,
  });
  customerId = customers.data[0]?.id;

  if (!customerId) {
    const email = await resolveClerkPrimaryEmail(userId);
    if (email) {
      const escapedEmail = stripeSearchLiteral(email);
      const byEmail = await stripe.customers.search({
        query: `email:'${escapedEmail}'`,
        limit: 10,
      });
      for (const customer of byEmail.data) {
        const listed = await stripe.subscriptions.list({
          customer: customer.id,
          status: "all",
          limit: 5,
        });
        if (
          listed.data.some(
            (s) => s.status === "active" || s.status === "trialing",
          )
        ) {
          customerId = customer.id;
          break;
        }
      }
      customerId ??= byEmail.data[0]?.id;
    }
  }

  if (!customerId) return null;

  const listed = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
  });
  const sub = listed.data.find(
    (s) => s.status === "active" || s.status === "trialing",
  );
  if (!sub) return null;

  return { sub, customerId };
}

/**
 * Pulls the user's active/trialing Stripe subscription and syncs Clerk + DB.
 * Used when webhooks did not reach the app (common in local dev).
 */
export async function syncActiveSubscriptionFromStripeForUser(
  userId: string,
): Promise<{ synced: boolean; planSlug: StripePaidPlanId | null }> {
  const resolved = await findActiveSubscriptionForClerkUser(userId);
  if (!resolved) {
    return { synced: false, planSlug: null };
  }

  const { sub, customerId } = resolved;

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
