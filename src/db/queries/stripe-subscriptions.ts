import { db } from "@/db";
import { stripeSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";

/** Table missing (migration `0015_stripe_subscriptions` not applied) — common in fresh local DBs. */
function isMissingStripeSubscriptionsTableError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth++) {
    const obj = current as Record<string, unknown>;
    const message = typeof obj.message === "string" ? obj.message : "";
    if (
      /stripe_subscriptions/i.test(message) &&
      /(does not exist|undefined table|relation .* does not exist)/i.test(message)
    ) {
      return true;
    }
    current = obj.cause;
  }
  const flat = String(error);
  return (
    (/42P01/i.test(flat) || /does not exist/i.test(flat)) &&
    /stripe_subscriptions/i.test(flat)
  );
}

/** Older DBs or mismatched schema (e.g. wrong column names). */
function isStripeSubscriptionsSchemaMismatch(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth++) {
    const obj = current as Record<string, unknown>;
    if (obj.code === "42703") {
      const message = typeof obj.message === "string" ? obj.message : "";
      if (/stripe_subscriptions/i.test(message)) return true;
    }
    current = obj.cause;
  }
  const flat = String(error);
  return /42703/.test(flat) && /stripe_subscriptions/i.test(flat);
}

function isRecoverableStripeSubscriptionsReadError(error: unknown): boolean {
  if (isMissingStripeSubscriptionsTableError(error)) return true;
  if (isStripeSubscriptionsSchemaMismatch(error)) return true;
  let current: unknown = error;
  for (let depth = 0; depth < 10 && current && typeof current === "object"; depth++) {
    const obj = current as Record<string, unknown>;
    if (obj["neon:retryable"] === true) return true;
    const message = typeof obj.message === "string" ? obj.message : "";
    if (
      /too many database connection attempts/i.test(message) ||
      /failed to acquire permit/i.test(message)
    ) {
      return true;
    }
    current = obj.cause;
  }
  const flat = String(error);
  return (
    /too many database connection attempts/i.test(flat) ||
    /failed to acquire permit/i.test(flat)
  );
}

export type UpsertStripeSubscriptionInput = {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeSubscriptionItemId?: string | null;
  planSlug?: string | null;
  status: string;
  currentPeriodEnd?: Date | null;
};

/**
 * Insert or update the Stripe subscription record for a user.
 * Conflicts on userId (one active row per user) — latest write wins.
 */
export async function upsertStripeSubscription(
  input: UpsertStripeSubscriptionInput,
) {
  const now = new Date();
  await db
    .insert(stripeSubscriptions)
    .values({
      userId: input.userId,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      stripeSubscriptionItemId: input.stripeSubscriptionItemId ?? null,
      planSlug: input.planSlug ?? null,
      status: input.status,
      currentPeriodEnd: input.currentPeriodEnd ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: stripeSubscriptions.userId,
      set: {
        stripeCustomerId: input.stripeCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        stripeSubscriptionItemId: input.stripeSubscriptionItemId ?? null,
        planSlug: input.planSlug ?? null,
        status: input.status,
        currentPeriodEnd: input.currentPeriodEnd ?? null,
        updatedAt: now,
      },
    });
}

/**
 * Stripe row the user can manage (portal, cancel at period end). Includes past_due;
 * excludes fully ended subscriptions.
 */
export async function getManageableStripeSubscription(userId: string) {
  try {
    const rows = await db
      .select()
      .from(stripeSubscriptions)
      .where(eq(stripeSubscriptions.userId, userId));

    const row = rows[0] ?? null;
    if (!row) return null;
    if (row.status === "canceled" || row.status === "incomplete_expired") {
      return null;
    }
    return row;
  } catch (error) {
    if (isRecoverableStripeSubscriptionsReadError(error)) return null;
    throw error;
  }
}

/**
 * Returns the active Stripe subscription for a user, or null if none exists.
 * Only returns rows with status "active" or "trialing".
 */
export async function getActiveStripeSubscription(userId: string) {
  try {
    const rows = await db
      .select()
      .from(stripeSubscriptions)
      .where(eq(stripeSubscriptions.userId, userId));

    const row = rows[0] ?? null;
    if (!row) return null;
    if (row.status !== "active" && row.status !== "trialing") return null;
    return row;
  } catch (error) {
    if (isRecoverableStripeSubscriptionsReadError(error)) return null;
    throw error;
  }
}

/**
 * Returns the raw subscription row for a user regardless of status.
 * Used when updating status after cancellation.
 */
export async function getStripeSubscriptionBySubscriptionId(
  stripeSubscriptionId: string,
) {
  try {
    const rows = await db
      .select()
      .from(stripeSubscriptions)
      .where(
        eq(stripeSubscriptions.stripeSubscriptionId, stripeSubscriptionId),
      );
    return rows[0] ?? null;
  } catch (error) {
    if (isRecoverableStripeSubscriptionsReadError(error)) return null;
    throw error;
  }
}

/** Mark a subscription row as canceled/expired by subscription ID. */
export async function markStripeSubscriptionStatus(
  stripeSubscriptionId: string,
  status: string,
) {
  await db
    .update(stripeSubscriptions)
    .set({ status, updatedAt: new Date() })
    .where(
      eq(stripeSubscriptions.stripeSubscriptionId, stripeSubscriptionId),
    );
}
