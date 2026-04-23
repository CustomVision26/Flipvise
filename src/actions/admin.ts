"use server";

import { auth } from "@/lib/clerk-auth";
import { createClerkClient } from "@clerk/backend";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAdminPrivilegeChange } from "@/db/queries/admin";
import {
  buildPublicMetadataPatchForAdminRoleGrant,
  buildPublicMetadataPatchForAdminRoleRevoke,
} from "@/lib/admin-role-metadata";
import { syncPlatformAdminTeamTierInvitedMetadata } from "@/lib/platform-admin-team-tier-metadata";
import {
  isClerkPlatformAdminRole,
  isClerkSuperadminRole,
} from "@/lib/clerk-platform-admin-role";
import { isPlatformSuperadminAllowListed } from "@/lib/platform-superadmin";
import {
  isAdminPlanAssignment,
  publicMetadataPatchForAdminPlanAssignment,
} from "@/lib/admin-assignable-plans";
import { PLAN_SOURCE_UPDATED_AT_KEY } from "@/lib/plan-metadata-billing-resolution";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

function readPublicRole(user: { publicMetadata: unknown }): string | undefined {
  return (user.publicMetadata as { role?: string })?.role;
}

function callerIsSuperadminActor(
  userId: string,
  caller: { publicMetadata: unknown },
): boolean {
  return isPlatformSuperadminAllowListed(userId) || isClerkSuperadminRole(readPublicRole(caller));
}

async function requirePlatformAdminActor() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const caller = await clerkClient.users.getUser(userId);
  const role = readPublicRole(caller);
  if (!isClerkPlatformAdminRole(role) && !isPlatformSuperadminAllowListed(userId)) {
    throw new Error("Forbidden");
  }
  return { userId, caller };
}

const toggleGrantSchema = z.object({
  targetUserId: z.string().min(1),
  grant: z.boolean(),
});

type ToggleGrantInput = z.infer<typeof toggleGrantSchema>;

export async function toggleAdminGrantAction(data: ToggleGrantInput) {
  const { userId } = await requirePlatformAdminActor();

  const parsed = toggleGrantSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { targetUserId, grant } = parsed.data;
  if (targetUserId === userId) throw new Error("Cannot modify your own access");

  // Clerk updateUserMetadata does a shallow merge; setting a key to null removes it.
  await clerkClient.users.updateUserMetadata(targetUserId, {
    publicMetadata: { adminGranted: grant ? true : null } as Record<string, unknown>,
  });

  revalidatePath("/admin");
}

const applyPlanAssignmentSchema = z.object({
  targetUserId: z.string().min(1),
  assignment: z.string().refine(isAdminPlanAssignment, "Invalid plan assignment"),
});

type ApplyPlanAssignmentInput = z.infer<typeof applyPlanAssignmentSchema>;

/**
 * Overwrites the target user's Clerk public metadata plan flags for testing / support.
 * Does not create or cancel Clerk Billing subscriptions.
 */
export async function applyAdminUserPlanAssignmentAction(data: ApplyPlanAssignmentInput) {
  const { userId } = await requirePlatformAdminActor();

  const parsed = applyPlanAssignmentSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { targetUserId, assignment } = parsed.data;
  if (targetUserId === userId) {
    throw new Error("You cannot change your own plan from this list");
  }

  const target = await clerkClient.users.getUser(targetUserId);
  const targetRole = readPublicRole(target);
  if (isPlatformSuperadminAllowListed(targetUserId) || isClerkSuperadminRole(targetRole)) {
    throw new Error("Cannot change plan metadata for a platform owner account from here");
  }

  const patch = publicMetadataPatchForAdminPlanAssignment(assignment);
  await clerkClient.users.updateUserMetadata(targetUserId, {
    publicMetadata: {
      ...patch,
      [PLAN_SOURCE_UPDATED_AT_KEY]: new Date().toISOString(),
    } as Record<string, unknown>,
  });

  revalidatePath("/admin");
}

const toggleAdminRoleSchema = z.object({
  targetUserId: z.string().min(1),
  targetUserName: z.string().min(1),
  grant: z.boolean(),
});

type ToggleAdminRoleInput = z.infer<typeof toggleAdminRoleSchema>;

export async function toggleAdminRoleAction(data: ToggleAdminRoleInput) {
  const { userId, caller } = await requirePlatformAdminActor();

  const parsed = toggleAdminRoleSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  if (!callerIsSuperadminActor(userId, caller)) throw new Error("Forbidden");

  const { targetUserId, targetUserName, grant } = parsed.data;
  if (targetUserId === userId) throw new Error("Cannot modify your own admin role");

  const target = await clerkClient.users.getUser(targetUserId);
  const targetRole = readPublicRole(target);
  if (isPlatformSuperadminAllowListed(targetUserId) || isClerkSuperadminRole(targetRole)) {
    throw new Error("Cannot change the platform owner role from the dashboard");
  }

  const previousMeta = target.publicMetadata as Record<string, unknown> | undefined;

  // Co-admin Pro unlock comes from `role === "admin"` (`getAccessContext` / client header).
  // Capture complimentary `adminGranted` in `preAdminGrantSnapshot` so revoking admin restores
  // the prior grant state; Clerk Billing + `has()` continue to control paid plan and expiration.
  const publicMetadata = grant
    ? buildPublicMetadataPatchForAdminRoleGrant(previousMeta)
    : buildPublicMetadataPatchForAdminRoleRevoke(previousMeta);

  await clerkClient.users.updateUserMetadata(targetUserId, {
    publicMetadata: publicMetadata as Record<string, unknown>,
  });

  if (grant) {
    try {
      await syncPlatformAdminTeamTierInvitedMetadata(clerkClient, targetUserId);
    } catch {
      // best-effort
    }
  }

  const callerName =
    [caller.firstName, caller.lastName].filter(Boolean).join(" ") ||
    caller.username ||
    caller.id;

  await logAdminPrivilegeChange({
    targetUserId,
    targetUserName,
    grantedByUserId: userId,
    grantedByName: callerName,
    action: grant ? "granted" : "revoked",
  });

  revalidatePath("/admin");
}

const toggleUserBanSchema = z.object({
  targetUserId: z.string().min(1),
  ban: z.boolean(),
});

type ToggleUserBanInput = z.infer<typeof toggleUserBanSchema>;

export async function toggleUserBanAction(data: ToggleUserBanInput) {
  const { userId, caller } = await requirePlatformAdminActor();

  const parsed = toggleUserBanSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { targetUserId, ban } = parsed.data;
  if (targetUserId === userId) throw new Error("Cannot ban your own account");

  const target = await clerkClient.users.getUser(targetUserId);
  const targetRole = readPublicRole(target);

  if (isPlatformSuperadminAllowListed(targetUserId) || isClerkSuperadminRole(targetRole)) {
    throw new Error("Cannot ban a platform owner account");
  }

  if (targetRole === "admin" && !callerIsSuperadminActor(userId, caller)) {
    throw new Error("Only the platform owner can ban or unban a co-admin account");
  }

  if (ban) {
    await clerkClient.users.banUser(targetUserId);
  } else {
    await clerkClient.users.unbanUser(targetUserId);
  }

  revalidatePath("/admin");
}
