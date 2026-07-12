import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { nativePushTokens } from "@/db/schema";

export type NativePushPlatform = "android" | "ios";

export async function upsertNativePushToken(input: {
  userId: string;
  token: string;
  platform: NativePushPlatform;
  appVersion?: string | null;
  label?: string | null;
}): Promise<void> {
  const now = new Date();
  const [existing] = await db
    .select({ id: nativePushTokens.id })
    .from(nativePushTokens)
    .where(eq(nativePushTokens.token, input.token))
    .limit(1);

  if (existing) {
    await db
      .update(nativePushTokens)
      .set({
        userId: input.userId,
        platform: input.platform,
        appVersion: input.appVersion ?? null,
        label: input.label ?? null,
        lastUsedAt: now,
        revokedAt: null,
      })
      .where(eq(nativePushTokens.id, existing.id));
    return;
  }

  await db.insert(nativePushTokens).values({
    userId: input.userId,
    token: input.token,
    platform: input.platform,
    appVersion: input.appVersion ?? null,
    label: input.label ?? null,
    lastUsedAt: now,
  });
}

export async function listActiveNativePushTokensForUser(
  userId: string,
): Promise<{ id: number; token: string; platform: string }[]> {
  return db
    .select({
      id: nativePushTokens.id,
      token: nativePushTokens.token,
      platform: nativePushTokens.platform,
    })
    .from(nativePushTokens)
    .where(
      and(eq(nativePushTokens.userId, userId), isNull(nativePushTokens.revokedAt)),
    );
}

export async function revokeNativePushToken(token: string): Promise<boolean> {
  if (!token.trim()) return false;
  const rows = await db
    .update(nativePushTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(nativePushTokens.token, token), isNull(nativePushTokens.revokedAt)),
    )
    .returning({ id: nativePushTokens.id });
  return rows.length > 0;
}

export async function revokeAllNativePushTokensForUser(userId: string): Promise<void> {
  await db
    .update(nativePushTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(nativePushTokens.userId, userId), isNull(nativePushTokens.revokedAt)),
    );
}

export async function deleteNativePushTokensForUser(userId: string): Promise<void> {
  await db.delete(nativePushTokens).where(eq(nativePushTokens.userId, userId));
}

/** Removes tokens Firebase rejected as invalid/unregistered. */
export async function deleteNativePushTokensByIds(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  for (const id of ids) {
    await db.delete(nativePushTokens).where(eq(nativePushTokens.id, id));
  }
}
