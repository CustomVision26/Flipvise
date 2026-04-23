import type { ClerkClient } from "@clerk/backend";
import { logAdminPrivilegeChange } from "@/db/queries/admin";
import { buildPublicMetadataPatchForSuperadminRoleGrant } from "@/lib/admin-role-metadata";
import { isClerkSuperadminRole } from "@/lib/clerk-platform-admin-role";
import { syncPlatformAdminTeamTierInvitedMetadata } from "@/lib/platform-admin-team-tier-metadata";

/** Comma-separated Clerk user IDs with full platform owner powers (grant/revoke co-admins, ban admins). */
export function parsePlatformSuperadminUserIds(): string[] {
  const raw = process.env.PLATFORM_SUPERADMIN_USER_IDS ?? "";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function isPlatformSuperadminAllowListed(userId: string): boolean {
  return parsePlatformSuperadminUserIds().includes(userId);
}

/**
 * Ensures allow-listed user IDs carry `publicMetadata.role === "superadmin"` in Clerk.
 * Call once per `/admin` load (before listing users) so metadata and team-tier sync stay aligned.
 */
export async function reconcilePlatformSuperadminClerkMetadata(
  clerkClient: ClerkClient,
  userId: string,
): Promise<boolean> {
  if (!isPlatformSuperadminAllowListed(userId)) return false;

  const user = await clerkClient.users.getUser(userId);
  const role = (user.publicMetadata as { role?: string })?.role;
  if (role === "superadmin") return false;

  const prev = user.publicMetadata as Record<string, unknown> | undefined;
  const publicMetadata: Record<string, unknown> =
    role === "admin" ? { role: "superadmin" } : buildPublicMetadataPatchForSuperadminRoleGrant(prev);

  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata,
  });

  try {
    await syncPlatformAdminTeamTierInvitedMetadata(clerkClient, userId);
  } catch {
    // best-effort
  }

  const targetUserName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    user.id;

  await logAdminPrivilegeChange({
    targetUserId: userId,
    targetUserName,
    grantedByUserId: userId,
    grantedByName: `${targetUserName} (PLATFORM_SUPERADMIN_USER_IDS)`,
    action: "superadmin_granted",
  });

  return true;
}
