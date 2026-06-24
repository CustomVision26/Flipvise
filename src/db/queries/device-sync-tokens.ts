import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { deviceSyncTokens } from "@/db/schema";

/**
 * Device sync tokens authenticate the bundled offline mobile app to `/api/sync`.
 * The raw token is returned to the device exactly once; only its SHA-256 hash is stored.
 */

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Mints a new token for a user and returns the raw value (store hash only). */
export async function createDeviceSyncToken(
  userId: string,
  label?: string | null,
): Promise<string> {
  const rawToken = randomBytes(32).toString("hex");
  await db.insert(deviceSyncTokens).values({
    userId,
    tokenHash: hashToken(rawToken),
    label: label ?? null,
  });
  return rawToken;
}

/**
 * Resolves the owning user id for a presented raw token, or null if unknown/revoked.
 * Updates `lastUsedAt` on success.
 */
export async function resolveUserIdByDeviceToken(
  rawToken: string,
): Promise<string | null> {
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);
  const [row] = await db
    .select({ id: deviceSyncTokens.id, userId: deviceSyncTokens.userId })
    .from(deviceSyncTokens)
    .where(
      and(
        eq(deviceSyncTokens.tokenHash, tokenHash),
        isNull(deviceSyncTokens.revokedAt),
      ),
    )
    .limit(1);
  if (!row) return null;

  await db
    .update(deviceSyncTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(deviceSyncTokens.id, row.id));

  return row.userId;
}

/** Removes all tokens for a user (account deletion). */
export async function deleteDeviceSyncTokensForUser(userId: string): Promise<void> {
  await db.delete(deviceSyncTokens).where(eq(deviceSyncTokens.userId, userId));
}
