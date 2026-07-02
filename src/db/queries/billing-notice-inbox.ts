import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { billingNoticeInboxMessages, inboxReads } from "@/db/schema";

function isMissingBillingNoticeInboxTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("billing_notice_inbox_messages") &&
    (msg.includes("does not exist") || msg.includes("relation"))
  );
}

export type BillingNoticeKind =
  | "trial_ending"
  | "trial_expired"
  | "payment_grace"
  | "payment_grace_expired";

export async function insertBillingNoticeInboxMessage(input: {
  recipientUserId: string;
  noticeKind: BillingNoticeKind;
  stripeSubscriptionId: string;
  planSlug: string;
  title: string;
  description: string;
  eventAt: Date;
  requiresAction?: boolean;
}): Promise<void> {
  try {
    await db
      .insert(billingNoticeInboxMessages)
      .values({
        recipientUserId: input.recipientUserId,
        noticeKind: input.noticeKind,
        stripeSubscriptionId: input.stripeSubscriptionId,
        planSlug: input.planSlug,
        title: input.title,
        description: input.description,
        eventAt: input.eventAt,
        requiresAction: input.requiresAction ?? true,
      })
      .onConflictDoNothing();
  } catch (error) {
    if (isMissingBillingNoticeInboxTableError(error)) return;
    throw error;
  }
}

export async function listBillingNoticeInboxMessagesForUser(
  userId: string,
  limit = 50,
) {
  try {
    return await db
      .select()
      .from(billingNoticeInboxMessages)
      .where(eq(billingNoticeInboxMessages.recipientUserId, userId))
      .orderBy(desc(billingNoticeInboxMessages.createdAt))
      .limit(limit);
  } catch (error) {
    if (isMissingBillingNoticeInboxTableError(error)) return [];
    throw error;
  }
}

export async function countUnreadBillingNoticeInboxForUser(
  userId: string,
): Promise<number> {
  try {
    const rows = await db
      .select({ id: billingNoticeInboxMessages.id })
      .from(billingNoticeInboxMessages)
      .where(eq(billingNoticeInboxMessages.recipientUserId, userId));

    if (rows.length === 0) return 0;

    const readRows = await db
      .select({ itemId: inboxReads.itemId })
      .from(inboxReads)
      .where(
        and(
          eq(inboxReads.userId, userId),
          eq(inboxReads.itemType, "billing_notice"),
          inArray(
            inboxReads.itemId,
            rows.map((r) => String(r.id)),
          ),
        ),
      );

    const readIds = new Set(readRows.map((r) => r.itemId));
    return rows.filter((r) => !readIds.has(String(r.id))).length;
  } catch (error) {
    if (isMissingBillingNoticeInboxTableError(error)) return 0;
    throw error;
  }
}

export async function deleteBillingNoticeInboxMessagesForUser(
  userId: string,
): Promise<void> {
  await db
    .delete(billingNoticeInboxMessages)
    .where(eq(billingNoticeInboxMessages.recipientUserId, userId));
}
