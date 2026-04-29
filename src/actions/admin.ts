"use server";

import { auth } from "@/lib/clerk-auth";
import { createClerkClient } from "@clerk/backend";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAdminPrivilegeChange, logAdminPlanAssignment } from "@/db/queries/admin";
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
import { isAdminPlanAssignment } from "@/lib/admin-assignable-plans";
import { applyPlanUpgrade } from "@/lib/apply-plan-upgrade";
import { countTeamsForOwner, insertTeam } from "@/db/queries/teams";
import { insertTeamWorkspaceEvent } from "@/db/queries/team-workspace-events";
import { isTeamPlanId, limitsForPlan, TEAM_PLAN_LABELS, type TeamPlanId } from "@/lib/team-plans";

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

function planSlugToDisplayName(slug: string | null | undefined): string {
  if (!slug || slug === "free") return "Free";
  if (slug === "pro") return "Pro";
  if (isTeamPlanId(slug)) return TEAM_PLAN_LABELS[slug as TeamPlanId];
  return slug;
}

function previousPlanSlugFromMeta(meta: Record<string, unknown>): string | null {
  const adminPlan = typeof meta.adminPlan === "string" ? meta.adminPlan : null;
  const plan = typeof meta.plan === "string" ? meta.plan : null;
  const billingPlan = typeof meta.billingPlan === "string" ? meta.billingPlan : null;
  return adminPlan ?? billingPlan ?? plan ?? null;
}

/**
 * Overwrites the target user's Clerk public metadata plan flags for testing / support.
 * Does not create or cancel Clerk Billing subscriptions.
 */
export async function applyAdminUserPlanAssignmentAction(data: ApplyPlanAssignmentInput) {
  const { userId, caller } = await requirePlatformAdminActor();

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

  const targetMeta = target.publicMetadata as Record<string, unknown>;
  const previousSlug = previousPlanSlugFromMeta(targetMeta);
  const targetName =
    [target.firstName, target.lastName].filter(Boolean).join(" ") ||
    target.username ||
    targetUserId;
  const targetEmail =
    target.emailAddresses.find((e) => e.id === target.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const callerName =
    [caller.firstName, caller.lastName].filter(Boolean).join(" ") ||
    caller.username ||
    userId;

  // Apply the plan — prorates an active Stripe subscription when one exists;
  // falls back to a Clerk-metadata-only write when there is none.
  await applyPlanUpgrade(targetUserId, assignment);

  await logAdminPlanAssignment({
    targetUserId,
    targetUserName: targetName,
    targetUserEmail: targetEmail,
    action: assignment === "free" ? "plan_removed" : "plan_assigned",
    planName: planSlugToDisplayName(assignment),
    previousPlanName: planSlugToDisplayName(previousSlug),
    assignedByUserId: userId,
    assignedByName: callerName,
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

  const targetName =
    [target.firstName, target.lastName].filter(Boolean).join(" ") ||
    target.username ||
    targetUserId;
  const targetEmail =
    target.emailAddresses.find((e) => e.id === target.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const callerName =
    [caller.firstName, caller.lastName].filter(Boolean).join(" ") ||
    caller.username ||
    userId;

  await logAdminPlanAssignment({
    targetUserId,
    targetUserName: targetName,
    targetUserEmail: targetEmail,
    action: ban ? "user_banned" : "user_unbanned",
    planName: null,
    previousPlanName: null,
    assignedByUserId: userId,
    assignedByName: callerName,
  });

  revalidatePath("/admin");
}

const createTeamWorkspaceForUserSchema = z.object({
  targetUserId: z.string().min(1),
  name: z.string().min(1).max(255),
});

type CreateTeamWorkspaceForUserInput = z.infer<
  typeof createTeamWorkspaceForUserSchema
>;

function readTeamPlanFromPublicMetadata(
  publicMetadata: unknown,
): string | null {
  const meta = publicMetadata as { plan?: unknown; teamPlanId?: unknown };
  if (typeof meta?.teamPlanId === "string" && meta.teamPlanId.trim().length > 0) {
    return meta.teamPlanId.trim();
  }
  if (typeof meta?.plan === "string" && meta.plan.trim().length > 0) {
    return meta.plan.trim();
  }
  return null;
}

export async function createTeamWorkspaceForUserAction(
  data: CreateTeamWorkspaceForUserInput,
) {
  const { userId } = await requirePlatformAdminActor();

  const parsed = createTeamWorkspaceForUserSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { targetUserId, name } = parsed.data;
  const workspaceName = name.trim();
  if (!workspaceName) throw new Error("Workspace name is required.");

  if (targetUserId === userId) {
    throw new Error("Use the team dashboard to create your own workspace.");
  }

  const target = await clerkClient.users.getUser(targetUserId);
  const targetRole = readPublicRole(target);
  if (
    isPlatformSuperadminAllowListed(targetUserId) ||
    isClerkSuperadminRole(targetRole) ||
    isClerkPlatformAdminRole(targetRole)
  ) {
    throw new Error("Cannot create a subscriber workspace for an admin account.");
  }

  const teamPlanSlug = readTeamPlanFromPublicMetadata(target.publicMetadata);
  if (!teamPlanSlug || !isTeamPlanId(teamPlanSlug)) {
    throw new Error("User must be on a team-tier plan before creating a workspace.");
  }

  const limits = limitsForPlan(teamPlanSlug);
  const existing = await countTeamsForOwner(targetUserId);
  if (existing >= limits.maxTeams) {
    throw new Error(
      `Workspace limit reached for this user (${limits.maxTeams} on their plan).`,
    );
  }

  const teamId = await insertTeam(targetUserId, workspaceName, teamPlanSlug);
  if (!teamId) throw new Error("Could not create workspace.");

  await insertTeamWorkspaceEvent({
    ownerUserId: targetUserId,
    action: "created",
    teamId,
    teamName: workspaceName,
    planSlug: teamPlanSlug,
    previousTeamName: null,
  });

  revalidatePath("/admin");
}
