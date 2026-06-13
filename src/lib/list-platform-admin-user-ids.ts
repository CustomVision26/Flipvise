import type { ClerkClient } from "@clerk/backend";
import { isClerkPlatformAdminRole } from "@/lib/clerk-platform-admin-role";
import { parsePlatformSuperadminUserIds } from "@/lib/platform-superadmin";

/** Clerk user ids that should receive support-ticket admin notifications. */
export async function listPlatformAdminRecipientUserIds(
  clerkClient: ClerkClient,
): Promise<string[]> {
  const ids = new Set(parsePlatformSuperadminUserIds());
  let offset = 0;
  const limit = 500;
  const maxUsers = 50_000;

  for (;;) {
    const res = await clerkClient.users.getUserList({ limit, offset });
    for (const user of res.data) {
      const role = (user.publicMetadata as { role?: string })?.role;
      if (isClerkPlatformAdminRole(role)) ids.add(user.id);
    }
    if (res.data.length < limit) break;
    offset += limit;
    if (offset >= maxUsers) break;
  }

  return [...ids];
}
