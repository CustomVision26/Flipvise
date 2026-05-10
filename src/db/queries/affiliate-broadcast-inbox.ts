import { db } from "@/db";
import { affiliateBroadcastInboxMessages, inboxReads } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export type AffiliateBroadcastVariant = "general" | "codes";

export async function insertAffiliateBroadcastInboxMessage(input: {
  recipientUserId: string;
  variant: AffiliateBroadcastVariant;
  subject: string;
  messageBody: string;
  detailsBlock: string;
  pricingPageUrl: string;
}) {
  const rows = await db
    .insert(affiliateBroadcastInboxMessages)
    .values({
      recipientUserId: input.recipientUserId,
      variant: input.variant,
      subject: input.subject,
      messageBody: input.messageBody,
      detailsBlock: input.detailsBlock,
      pricingPageUrl: input.pricingPageUrl,
    })
    .returning({ id: affiliateBroadcastInboxMessages.id });
  return rows[0]?.id ?? null;
}

export async function listAffiliateBroadcastInboxForUser(userId: string, limit = 200) {
  return db
    .select()
    .from(affiliateBroadcastInboxMessages)
    .where(eq(affiliateBroadcastInboxMessages.recipientUserId, userId))
    .orderBy(desc(affiliateBroadcastInboxMessages.createdAt))
    .limit(limit);
}

/** Unread affiliate admin broadcasts for the header inbox badge (matches dashboard inbox read rules). */
export async function countUnreadAffiliateBroadcastInboxForUser(userId: string): Promise<number> {
  const rows = await db
    .select({ id: affiliateBroadcastInboxMessages.id })
    .from(affiliateBroadcastInboxMessages)
    .where(eq(affiliateBroadcastInboxMessages.recipientUserId, userId));

  if (rows.length === 0) return 0;

  const readRows = await db
    .select({ itemId: inboxReads.itemId })
    .from(inboxReads)
    .where(
      and(eq(inboxReads.userId, userId), eq(inboxReads.itemType, "affiliate_broadcast")),
    );

  const readIds = new Set(readRows.map((r) => r.itemId));
  return rows.reduce((acc, row) => acc + (readIds.has(String(row.id)) ? 0 : 1), 0);
}
