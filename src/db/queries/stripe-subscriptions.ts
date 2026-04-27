import { db } from "@/db";
import { stripeSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";

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
 * Returns the active Stripe subscription for a user, or null if none exists.
 * Only returns rows with status "active" or "trialing".
 */
export async function getActiveStripeSubscription(userId: string) {
  const rows = await db
    .select()
    .from(stripeSubscriptions)
    .where(eq(stripeSubscriptions.userId, userId));

  const row = rows[0] ?? null;
  if (!row) return null;
  if (row.status !== "active" && row.status !== "trialing") return null;
  return row;
}

/**
 * Returns the raw subscription row for a user regardless of status.
 * Used when updating status after cancellation.
 */
export async function getStripeSubscriptionBySubscriptionId(
  stripeSubscriptionId: string,
) {
  const rows = await db
    .select()
    .from(stripeSubscriptions)
    .where(eq(stripeSubscriptions.stripeSubscriptionId, stripeSubscriptionId));
  return rows[0] ?? null;
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
