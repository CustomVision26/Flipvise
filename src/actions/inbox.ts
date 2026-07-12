"use server";

import { z } from "zod";
import { currentUser } from "@/lib/clerk-auth";
import { getAccessContext } from "@/lib/access";
import { markInboxItemRead, markAllInboxItemsRead } from "@/db/queries/inbox-reads";
import { recordWelcomeInboxMessage } from "@/lib/record-welcome-inbox";

const markReadSchema = z.object({
  itemType: z.string().min(1).max(64),
  itemId: z.string().min(1).max(255),
});

export async function markInboxItemReadAction(
  data: z.infer<typeof markReadSchema>,
): Promise<void> {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = markReadSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  await markInboxItemRead(userId, parsed.data.itemType, parsed.data.itemId);
}

const markAllReadSchema = z.object({
  items: z.array(markReadSchema).min(1),
});

export async function markAllInboxItemsReadAction(
  data: z.infer<typeof markAllReadSchema>,
): Promise<void> {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = markAllReadSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  await markAllInboxItemsRead(userId, parsed.data.items);
}

/** Idempotent — ensures a one-time welcome inbox row exists for the signed-in user. */
export async function ensureWelcomeInboxMessageAction(): Promise<void> {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const user = await currentUser();
  await recordWelcomeInboxMessage({
    recipientUserId: userId,
    firstName: user?.firstName,
  });
}
