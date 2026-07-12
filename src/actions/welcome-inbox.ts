"use server";

import { currentUser } from "@/lib/clerk-auth";
import { getAccessContext } from "@/lib/access";
import { ensureWelcomeInboxForUserIfMissing } from "@/lib/record-welcome-inbox";

/** Idempotent — ensures a one-time welcome inbox row exists for the signed-in user. */
export async function ensureWelcomeInboxMessageAction(): Promise<void> {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const user = await currentUser();
  await ensureWelcomeInboxForUserIfMissing({
    recipientUserId: userId,
    firstName: user?.firstName,
  });
}
