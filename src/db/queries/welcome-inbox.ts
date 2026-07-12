import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { inboxReads, welcomeInboxMessages } from "@/db/schema";

function isMissingWelcomeInboxTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("welcome_inbox_messages") &&
    (msg.includes("does not exist") || msg.includes("relation"))
  );
}

export async function insertWelcomeInboxMessage(input: {
  recipientUserId: string;
  title: string;
  description: string;
}): Promise<void> {
  try {
    await db
      .insert(welcomeInboxMessages)
      .values({
        recipientUserId: input.recipientUserId,
        title: input.title,
        description: input.description,
      })
      .onConflictDoNothing();
  } catch (error) {
    if (isMissingWelcomeInboxTableError(error)) return;
    throw error;
  }
}

export async function listWelcomeInboxMessagesForUser(userId: string, limit = 5) {
  try {
    return await db
      .select()
      .from(welcomeInboxMessages)
      .where(eq(welcomeInboxMessages.recipientUserId, userId))
      .orderBy(desc(welcomeInboxMessages.createdAt))
      .limit(limit);
  } catch (error) {
    if (isMissingWelcomeInboxTableError(error)) return [];
    throw error;
  }
}

export async function countUnreadWelcomeInboxForUser(userId: string): Promise<number> {
  try {
    const rows = await db
      .select({ id: welcomeInboxMessages.id })
      .from(welcomeInboxMessages)
      .where(eq(welcomeInboxMessages.recipientUserId, userId));

    if (rows.length === 0) return 0;

    const readRows = await db
      .select({ itemId: inboxReads.itemId })
      .from(inboxReads)
      .where(
        and(
          eq(inboxReads.userId, userId),
          eq(inboxReads.itemType, "welcome"),
          inArray(
            inboxReads.itemId,
            rows.map((r) => String(r.id)),
          ),
        ),
      );

    const readIds = new Set(readRows.map((r) => r.itemId));
    return rows.filter((r) => !readIds.has(String(r.id))).length;
  } catch (error) {
    if (isMissingWelcomeInboxTableError(error)) return 0;
    throw error;
  }
}

export async function deleteWelcomeInboxMessagesForUser(userId: string): Promise<void> {
  await db
    .delete(welcomeInboxMessages)
    .where(eq(welcomeInboxMessages.recipientUserId, userId));
}
