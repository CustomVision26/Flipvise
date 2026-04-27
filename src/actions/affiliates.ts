"use server";

import { auth } from "@/lib/clerk-auth";
import { createClerkClient } from "@clerk/backend";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { z } from "zod";
import {
  insertAffiliate,
  revokeAffiliateById,
  getAffiliateById,
  updateAffiliateById,
  getAffiliateByToken,
  acceptAffiliateByToken,
  cancelAffiliateInvite,
} from "@/db/queries/affiliates";
import { isClerkPlatformAdminRole } from "@/lib/clerk-platform-admin-role";
import { isPlatformSuperadminAllowListed } from "@/lib/platform-superadmin";
import {
  isAdminPlanAssignment,
  publicMetadataPatchForAdminPlanAssignment,
  type AdminPlanAssignment,
} from "@/lib/admin-assignable-plans";
import {
  ADMIN_PLAN_UPDATED_AT_KEY,
  PLAN_SOURCE_UPDATED_AT_KEY,
  resolveEffectivePlan,
} from "@/lib/plan-metadata-billing-resolution";
import { isTeamPlanId } from "@/lib/team-plans";
import { applyPlanUpgrade } from "@/lib/apply-plan-upgrade";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function readPublicRole(user: { publicMetadata: unknown }): string | undefined {
  return (user.publicMetadata as { role?: string })?.role;
}

async function requirePlatformAdminActor() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const caller = await clerkClient.users.getUser(userId);
  const role = readPublicRole(caller);
  if (!isClerkPlatformAdminRole(role) && !isPlatformSuperadminAllowListed(userId)) {
    throw new Error("Forbidden");
  }
  const callerName =
    [caller.firstName, caller.lastName].filter(Boolean).join(" ") ||
    caller.username ||
    caller.id;
  return { userId, callerName };
}

// ─── Clerk plan helpers ───────────────────────────────────────────────────────

/**
 * Apply or clear an affiliate plan on their Clerk account following
 * the resolve-effective-plan rules.
 * Pass "free" to clear the admin grant (revoke / pre-acceptance path).
 */
async function applyAffiliatePlanToClerk(
  targetUserId: string,
  plan: AdminPlanAssignment,
): Promise<void> {
  const target = await clerkClient.users.getUser(targetUserId);
  const existing = target.publicMetadata as Record<string, unknown>;
  const now = new Date().toISOString();

  const patch = publicMetadataPatchForAdminPlanAssignment(plan);
  const merged: Record<string, unknown> = {
    ...existing,
    ...patch,
    [ADMIN_PLAN_UPDATED_AT_KEY]: plan === "free" ? null : now,
    [PLAN_SOURCE_UPDATED_AT_KEY]: plan === "free" ? null : now,
  };

  const resolvedPlan = resolveEffectivePlan(merged);
  const isTeamPlan = resolvedPlan !== null && isTeamPlanId(resolvedPlan);

  await clerkClient.users.updateUserMetadata(targetUserId, {
    publicMetadata: {
      ...merged,
      plan: resolvedPlan,
      teamPlanId: isTeamPlan ? resolvedPlan : null,
    } as Record<string, unknown>,
  });
}

/** Look up a Clerk user ID by email address (best-effort, returns null if not found). */
async function findClerkUserIdByEmail(email: string): Promise<string | null> {
  try {
    const result = await clerkClient.users.getUserList({
      emailAddress: [email],
      limit: 1,
    });
    return result.data[0]?.id ?? null;
  } catch {
    return null;
  }
}

// ─── Email lookup (for invite dialog preview) ─────────────────────────────────

export type EmailLookupResult =
  | { found: false }
  | {
      found: true;
      name: string;
      currentPlan: string;
    };

const lookupEmailSchema = z.object({ email: z.string().email() });

export async function lookupAffiliateEmailAction(
  data: z.infer<typeof lookupEmailSchema>,
): Promise<EmailLookupResult> {
  await requirePlatformAdminActor();

  const parsed = lookupEmailSchema.safeParse(data);
  if (!parsed.success) return { found: false };

  try {
    const result = await clerkClient.users.getUserList({
      emailAddress: [parsed.data.email],
      limit: 1,
    });
    const user = result.data[0];
    if (!user) return { found: false };

    const meta = user.publicMetadata as { plan?: string };
    const planSlug = meta?.plan ?? null;
    const planLabel = planSlug
      ? planSlug === "pro"
        ? "Pro"
        : planSlug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Free";

    const name =
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.username ||
      user.primaryEmailAddress?.emailAddress ||
      "Unknown";

    return { found: true, name, currentPlan: planLabel };
  } catch {
    return { found: false };
  }
}

// ─── Invite ───────────────────────────────────────────────────────────────────

const inviteAffiliateSchema = z.object({
  affiliateName: z.string().min(1).max(255),
  invitedEmail: z.string().email(),
  planAssigned: z.string().refine(isAdminPlanAssignment, "Invalid plan"),
  endsAt: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid date"),
});

export type InviteAffiliateInput = z.infer<typeof inviteAffiliateSchema>;

export async function inviteAffiliateAction(data: InviteAffiliateInput) {
  const { userId, callerName } = await requirePlatformAdminActor();

  const parsed = inviteAffiliateSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input: " + parsed.error.message);

  const { affiliateName, invitedEmail, planAssigned, endsAt } = parsed.data;

  const endsAtDate = new Date(endsAt);
  if (endsAtDate <= new Date()) throw new Error("End date must be in the future");

  // Resolve Clerk user for this email (may not exist yet)
  const invitedUserId = await findClerkUserIdByEmail(invitedEmail);

  // Generate a secure URL-safe token for the accept link
  const token = randomBytes(32).toString("hex");

  // Persist the affiliate as PENDING — plan is NOT applied until accepted
  await insertAffiliate({
    invitedEmail,
    invitedUserId,
    affiliateName,
    planAssigned,
    endsAt: endsAtDate,
    addedByUserId: userId,
    addedByName: callerName,
    token,
    status: "pending",
  });

  revalidatePath("/admin");
  revalidatePath("/admin/marketing-affiliates");
}

// ─── Accept ───────────────────────────────────────────────────────────────────

const acceptAffiliateSchema = z.object({ token: z.string().min(1) });
export type AcceptAffiliateInput = z.infer<typeof acceptAffiliateSchema>;

export async function acceptAffiliateInviteAction(data: AcceptAffiliateInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("You must be signed in to accept an invite");

  const parsed = acceptAffiliateSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid token");

  const { token } = parsed.data;
  const affiliate = await getAffiliateByToken(token);

  if (!affiliate) throw new Error("Invite not found or already used");
  if (affiliate.status !== "pending") {
    throw new Error(
      affiliate.status === "active"
        ? "This invite has already been accepted"
        : "This invite is no longer valid",
    );
  }

  // Verify the logged-in user's email matches the invite
  const clerkUser = await clerkClient.users.getUser(userId);
  const userEmails = clerkUser.emailAddresses.map((e) => e.emailAddress.toLowerCase());
  if (!userEmails.includes(affiliate.invitedEmail.toLowerCase())) {
    throw new Error(
      "This invite was sent to a different email address. " +
        "Please sign in with the account that matches " +
        affiliate.invitedEmail,
    );
  }

  // Accept: set status → active, record who accepted
  await acceptAffiliateByToken(token, userId);

  // Apply the plan — prorates an existing Stripe subscription when present;
  // falls back to a complimentary Clerk-metadata grant when there is none.
  await applyPlanUpgrade(userId, affiliate.planAssigned);

  revalidatePath("/dashboard/inbox");
  revalidatePath("/affiliate/accept");
}

// ─── Cancel pending invite ────────────────────────────────────────────────────

const cancelAffiliateSchema = z.object({ affiliateId: z.number().int().positive() });
export type CancelAffiliateInput = z.infer<typeof cancelAffiliateSchema>;

export async function cancelAffiliateInviteAction(data: CancelAffiliateInput) {
  const { userId, callerName } = await requirePlatformAdminActor();

  const parsed = cancelAffiliateSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const existing = await getAffiliateById(parsed.data.affiliateId);
  if (!existing) throw new Error("Affiliate not found");
  if (existing.status !== "pending") throw new Error("Invite is not pending");

  await cancelAffiliateInvite(parsed.data.affiliateId);

  revalidatePath("/admin");
  revalidatePath("/admin/marketing-affiliates");
}

// ─── Edit ─────────────────────────────────────────────────────────────────────

const updateAffiliateSchema = z.object({
  affiliateId: z.number().int().positive(),
  affiliateName: z.string().min(1).max(255),
  invitedEmail: z.string().email(),
  planAssigned: z.string().refine(isAdminPlanAssignment, "Invalid plan"),
  endsAt: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid date"),
});

export type UpdateAffiliateInput = z.infer<typeof updateAffiliateSchema>;

export async function updateAffiliateAction(data: UpdateAffiliateInput) {
  await requirePlatformAdminActor();

  const parsed = updateAffiliateSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input: " + parsed.error.message);

  const { affiliateId, affiliateName, invitedEmail, planAssigned, endsAt } = parsed.data;

  const existing = await getAffiliateById(affiliateId);
  if (!existing) throw new Error("Affiliate not found");
  if (existing.status === "revoked") throw new Error("Cannot edit a revoked affiliate");

  const emailChanged = invitedEmail.toLowerCase() !== existing.invitedEmail.toLowerCase();

  // Resolve the Clerk user for the (possibly updated) email
  const newClerkUserId = emailChanged
    ? await findClerkUserIdByEmail(invitedEmail)
    : existing.invitedUserId ?? null;

  // If email changed and old user had an active affiliate plan, clear it
  if (emailChanged && existing.invitedUserId && existing.status === "active") {
    await applyAffiliatePlanToClerk(existing.invitedUserId, "free");
  }

  await updateAffiliateById(affiliateId, {
    affiliateName,
    invitedEmail,
    planAssigned,
    endsAt: new Date(endsAt),
    invitedUserId: emailChanged ? newClerkUserId : undefined,
  });

  // Re-apply plan if already active (e.g., plan slug changed)
  if (existing.status === "active" && newClerkUserId) {
    await applyAffiliatePlanToClerk(
      newClerkUserId,
      planAssigned as AdminPlanAssignment,
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/marketing-affiliates");
}

// ─── Revoke ───────────────────────────────────────────────────────────────────

const revokeAffiliateSchema = z.object({ affiliateId: z.number().int().positive() });
export type RevokeAffiliateInput = z.infer<typeof revokeAffiliateSchema>;

export async function revokeAffiliateAction(data: RevokeAffiliateInput) {
  const { userId, callerName } = await requirePlatformAdminActor();

  const parsed = revokeAffiliateSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { affiliateId } = parsed.data;
  const existing = await getAffiliateById(affiliateId);
  if (!existing) throw new Error("Affiliate not found");
  if (existing.status === "revoked") throw new Error("Already revoked");

  await revokeAffiliateById(affiliateId, userId, callerName);

  // Clear admin-granted plan if the affiliate had accepted
  if (existing.status === "active" && existing.invitedUserId) {
    await applyAffiliatePlanToClerk(existing.invitedUserId, "free");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/marketing-affiliates");
}
