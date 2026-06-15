import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { inboxReads, subscriptionCheckoutConfirmations } from "@/db/schema";

function isMissingSubscriptionCheckoutConfirmationsTableError(
  error: unknown,
): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("subscription_checkout_confirmations") &&
    (msg.includes("does not exist") || msg.includes("relation"))
  );
}

export async function upsertSubscriptionCheckoutConfirmation(input: {
  userId: string;
  checkoutSessionId: string;
  planSlug: string;
  planLabel: string;
  period: string;
  amountCents?: number | null;
  currency?: string | null;
  promoDisplay?: string | null;
  receiptUrl?: string | null;
}) {
  const receiptUrl = input.receiptUrl?.trim() || null;
  try {
    await db
      .insert(subscriptionCheckoutConfirmations)
      .values({
        userId: input.userId,
        checkoutSessionId: input.checkoutSessionId,
        planSlug: input.planSlug,
        planLabel: input.planLabel,
        period: input.period,
        amountCents: input.amountCents ?? null,
        currency: input.currency ?? null,
        promoDisplay: input.promoDisplay ?? null,
        receiptUrl,
      })
      .onConflictDoUpdate({
        target: subscriptionCheckoutConfirmations.checkoutSessionId,
        set: {
          planSlug: input.planSlug,
          planLabel: input.planLabel,
          period: input.period,
          amountCents: input.amountCents ?? null,
          currency: input.currency ?? null,
          promoDisplay: input.promoDisplay ?? null,
          ...(receiptUrl ? { receiptUrl } : {}),
        },
      });
  } catch (error) {
    if (isMissingSubscriptionCheckoutConfirmationsTableError(error)) return;
    throw error;
  }
}

export async function listSubscriptionCheckoutConfirmationsForUser(
  userId: string,
  limit = 50,
) {
  try {
    return await db
      .select()
      .from(subscriptionCheckoutConfirmations)
      .where(eq(subscriptionCheckoutConfirmations.userId, userId))
      .orderBy(desc(subscriptionCheckoutConfirmations.createdAt))
      .limit(limit);
  } catch (error) {
    if (isMissingSubscriptionCheckoutConfirmationsTableError(error)) return [];
    throw error;
  }
}

/** Unread subscription confirmations for the header inbox badge. */
export async function countUnreadSubscriptionCheckoutConfirmationsForUser(
  userId: string,
): Promise<number> {
  try {
    const rows = await db
      .select({ id: subscriptionCheckoutConfirmations.id })
      .from(subscriptionCheckoutConfirmations)
      .where(eq(subscriptionCheckoutConfirmations.userId, userId));

    if (rows.length === 0) return 0;

    const readRows = await db
      .select({ itemId: inboxReads.itemId })
      .from(inboxReads)
      .where(
        and(
          eq(inboxReads.userId, userId),
          eq(inboxReads.itemType, "subscription_confirmed"),
          inArray(
            inboxReads.itemId,
            rows.map((r) => String(r.id)),
          ),
        ),
      );

    const readIds = new Set(readRows.map((r) => r.itemId));
    return rows.filter((r) => !readIds.has(String(r.id))).length;
  } catch (error) {
    if (isMissingSubscriptionCheckoutConfirmationsTableError(error)) return 0;
    throw error;
  }
}
