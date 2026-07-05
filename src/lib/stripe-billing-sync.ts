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
  resolveClerkBillingStatusFromStripe,
  stripeSubscriptionTrialEnd,
} from "@/lib/billing-stripe-status";
import {
  STRIPE_PAID_PLAN_IDS,
  type StripePaidPlanId,
} from "@/lib/billing-plan-ids";
import { canonicalEducationPlanId, isEducationTeamPlanId } from "@/lib/education-plans";
import { planSlugFromStripePriceId } from "@/lib/stripe-plan-price-env";
import { stripe } from "@/lib/stripe";
import { canonicalTeamPlanId, isTeamPlanId } from "@/lib/team-plans";

function planRank(planSlug: string | undefined): number {
  const slug = planSlug?.trim() ?? "";
  const idx = (STRIPE_PAID_PLAN_IDS as readonly string[]).indexOf(slug);
  return idx >= 0 ? idx : -1;
}

/** When multiple active/trialing subs exist, keep highest tier then newest. */
export function pickPreferredStripeSubscription(
  subs: Stripe.Subscription[],
): Stripe.Subscription | null {
  const manageable = subs.filter(
    (s) => s.status === "active" || s.status === "trialing",
  );
  if (manageable.length === 0) return null;
  return [...manageable].sort((a, b) => {
    const rankDiff = planRank(b.metadata?.plan) - planRank(a.metadata?.plan);
    if (rankDiff !== 0) return rankDiff;
    return b.created - a.created;
  })[0]!;
}

async function resolvePlanSlugFromStripeSubscription(
  sub: Stripe.Subscription,
  customerId: string,
): Promise<StripePaidPlanId | null> {
  const fromSubMeta = asPaidPlanId(sub.metadata?.plan);
  if (fromSubMeta) return fromSubMeta;

  const priceId =
    typeof sub.items?.data?.[0]?.price === "string"
      ? sub.items.data[0].price
      : sub.items?.data?.[0]?.price?.id;
  const fromPrice = planSlugFromStripePriceId(priceId);
  if (fromPrice) return fromPrice;

  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted) {
      return asPaidPlanId(customer.metadata?.plan);
    }
  } catch {
    // omit
  }
  return null;
}

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
  if (canonTeam) return canonTeam;
  const canonEducation = canonicalEducationPlanId(trimmed);
  if (canonEducation) return canonEducation;
  return null;
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

  const previousPlan = resolveEffectivePlan(existing);

  const updated: Record<string, unknown> = {
    ...existing,
    [BILLING_PLAN_KEY]: plan,
    [BILLING_STATUS_KEY]: status,
    [BILLING_PLAN_UPDATED_AT_KEY]: now,
  };

  const resolvedPlan = resolveEffectivePlan(updated);
  const isTeamPlan =
    resolvedPlan !== null &&
    (isTeamPlanId(resolvedPlan) || isEducationTeamPlanId(resolvedPlan));

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
    const canonicalEducation =
      resolvedPlan !== null ? canonicalEducationPlanId(resolvedPlan) : null;
    const planForTeams =
      canonicalTeam ??
      (canonicalEducation && isEducationTeamPlanId(canonicalEducation)
        ? canonicalEducation
        : null);
    if (planForTeams) {
      await updateOwnedTeamsPlanSlug(userId, planForTeams);
    }
  } catch {
    // Best-effort
  }

  try {
    const { handlePlanTransition } = await import("@/lib/plan-transition");
    await handlePlanTransition(userId, previousPlan, resolvedPlan);
  } catch {
    // Best-effort
  }
}

export async function upsertStripeSubscriptionFromStripeSub(
  userId: string,
  sub: Stripe.Subscription,
  planSlug: StripePaidPlanId | null,
  options?: {
    paymentFailedAt?: Date | null;
  },
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
    trialEnd: stripeSubscriptionTrialEnd(sub),
    ...(options?.paymentFailedAt !== undefined
      ? { paymentFailedAt: options.paymentFailedAt }
      : {}),
  });
}

function billingStatusFromStripeSubscription(
  status: Stripe.Subscription.Status,
  paymentFailedAt?: Date | null,
): BillingStatusValue {
  return resolveClerkBillingStatusFromStripe({
    stripeStatus: status,
    paymentFailedAt,
  });
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
 * Active/trialing subscription for a Clerk user (DB-independent Stripe lookup).
 * Subscription metadata is checked first — Checkout always sets `clerkUserId` there,
 * even before customer metadata is patched.
 */
export async function findActiveSubscriptionForClerkUser(userId: string): Promise<{
  sub: Stripe.Subscription;
  customerId: string;
} | null> {
  try {
    return await findActiveSubscriptionForClerkUserInner(userId);
  } catch (error) {
    console.error("[findActiveSubscriptionForClerkUser]", error);
    return null;
  }
}

async function findActiveSubscriptionForClerkUserInner(userId: string): Promise<{
  sub: Stripe.Subscription;
  customerId: string;
} | null> {
  const uid = stripeSearchLiteral(userId);

  try {
    const bySubMeta = await stripe.subscriptions.search({
      query: `metadata['clerkUserId']:'${uid}' AND (status:'active' OR status:'trialing')`,
      limit: 100,
    });
    const subFromMeta = pickPreferredStripeSubscription(bySubMeta.data);
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

  try {
    const customers = await stripe.customers.search({
      query: `metadata['clerkUserId']:'${uid}'`,
      limit: 1,
    });
    customerId = customers.data[0]?.id;
  } catch {
    // Stripe Search may be unavailable — fall through to email lookup.
  }

  if (!customerId) {
    const email = await resolveClerkPrimaryEmail(userId);
    if (email) {
      let customersByEmail: Stripe.Customer[] = [];
      try {
        const escapedEmail = stripeSearchLiteral(email);
        const byEmail = await stripe.customers.search({
          query: `email:'${escapedEmail}'`,
          limit: 10,
        });
        customersByEmail = byEmail.data;
      } catch {
        const listed = await stripe.customers.list({ email, limit: 10 });
        customersByEmail = listed.data;
      }

      for (const customer of customersByEmail) {
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
      customerId ??= customersByEmail[0]?.id;
    }
  }

  if (!customerId) return null;

  const listed = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });
  const sub = pickPreferredStripeSubscription(listed.data);
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

  const plan = await resolvePlanSlugFromStripeSubscription(sub, customerId);
  if (!plan) {
    console.error(
      "[syncActiveSubscriptionFromStripeForUser] could not resolve plan",
      { userId, subscriptionId: sub.id },
    );
    return { synced: false, planSlug: null };
  }
  const billingStatus = billingStatusFromStripeSubscription(sub.status);

  await setStripeBillingState(userId, plan, billingStatus);
  await upsertStripeSubscriptionFromStripeSub(userId, sub, plan);

  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted) {
      await stripe.customers.update(customerId, {
        metadata: { clerkUserId: userId, plan },
      });
    }
  } catch (error) {
    console.error("[syncActiveSubscriptionFromStripeForUser] customer update:", error);
  }

  return { synced: true, planSlug: plan };
}
