import { db } from "@/db";
import { inboxReads } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/** Returns a Set of `"itemType:itemId"` strings the user has read. */
export async function getInboxReadsForUser(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ itemType: inboxReads.itemType, itemId: inboxReads.itemId })
    .from(inboxReads)
    .where(eq(inboxReads.userId, userId));
  return new Set(rows.map((r) => `${r.itemType}:${r.itemId}`));
}

/** Marks a single inbox item as read for a user. Safe to call multiple times (idempotent). */
export async function markInboxItemRead(
  userId: string,
  itemType: string,
  itemId: string,
): Promise<void> {
  await db
    .insert(inboxReads)
    .values({ userId, itemType, itemId })
    .onConflictDoNothing();
}

/** Marks all supplied items as read in a single batch. */
export async function markAllInboxItemsRead(
  userId: string,
  items: { itemType: string; itemId: string }[],
): Promise<void> {
  if (items.length === 0) return;
  await db
    .insert(inboxReads)
    .values(items.map((i) => ({ userId, itemType: i.itemType, itemId: i.itemId })))
    .onConflictDoNothing();
}
