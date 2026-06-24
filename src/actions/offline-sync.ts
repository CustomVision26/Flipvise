"use server";

import { auth } from "@/lib/clerk-auth";
import { createDeviceSyncToken } from "@/db/queries/device-sync-tokens";

/**
 * Mints a long-lived device sync token for the signed-in user. Called from the
 * authenticated live site (inside the native app) so the bundled offline Study app can
 * later authenticate to `/api/sync` with no Clerk session of its own.
 *
 * The raw token is returned ONCE — the caller persists it in native storage.
 */
export async function createDeviceSyncTokenAction(input?: {
  label?: string;
}): Promise<{ token: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const label =
    typeof input?.label === "string" ? input.label.slice(0, 128) : null;
  const token = await createDeviceSyncToken(userId, label);
  return { token };
}
