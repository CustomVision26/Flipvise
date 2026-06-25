import { auth } from "@clerk/nextjs/server";
import { resolveUserIdByDeviceToken } from "@/db/queries/device-sync-tokens";

/** Resolves the acting user from a Bearer device token, falling back to the Clerk session. */
export async function resolveSyncUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    const tokenUserId = await resolveUserIdByDeviceToken(token);
    if (tokenUserId) return tokenUserId;
  }
  const { userId } = await auth();
  return userId ?? null;
}
