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
import { deleteInboxReadForUserItem } from "@/db/queries/inbox-reads";
import { isClerkPlatformAdminRole } from "@/lib/clerk-platform-admin-role";
import { isPlatformSuperadminAllowListed } from "@/lib/platform-superadmin";
import {
  isAdminPlanAssignment,
  labelForAdminPlanAssignment,
  publicMetadataPatchForAdminPlanAssignment,
  type AdminPlanAssignment,
} from "@/lib/admin-assignable-plans";
import {
  computeAffiliateInviteExpiresAtFromDays,
  getAffiliateInviteExpiryDays,
  isAffiliateInviteExpired,
} from "@/lib/affiliate-invite-expiry";
import {
  loopsSendAffiliateArrangementUpdateEmail,
  loopsSendAffiliateInvitationEmail,
} from "@/lib/loops";
import { resolveAppUrl } from "@/lib/stripe";
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
  inviteExpiresInDays: z.number().int().min(1).max(365),
});

export type InviteAffiliateInput = z.infer<typeof inviteAffiliateSchema>;

export async function inviteAffiliateAction(data: InviteAffiliateInput) {
  const { userId, callerName } = await requirePlatformAdminActor();

  const parsed = inviteAffiliateSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input: " + parsed.error.message);

  const { affiliateName, invitedEmail, planAssigned, endsAt, inviteExpiresInDays } =
    parsed.data;
  const normalizedInviteeEmail = invitedEmail.trim().toLowerCase();

  const endsAtDate = new Date(endsAt);
  if (endsAtDate <= new Date()) throw new Error("End date must be in the future");

  // Resolve Clerk user for this email (may not exist yet)
  const invitedUserId = await findClerkUserIdByEmail(normalizedInviteeEmail);

  // Generate a secure URL-safe token for the accept link
  const token = randomBytes(32).toString("hex");
  const inviteExpiresAt = computeAffiliateInviteExpiresAtFromDays(inviteExpiresInDays);

  // Persist the affiliate as PENDING — plan is NOT applied until accepted
  await insertAffiliate({
    invitedEmail: normalizedInviteeEmail,
    invitedUserId,
    affiliateName,
    planAssigned,
    endsAt: endsAtDate,
    inviteExpiresAt,
    addedByUserId: userId,
    addedByName: callerName,
    token,
    status: "pending",
  });

  const base = resolveAppUrl();
  const acceptAffiliateUrl = `${base}/affiliate/accept?token=${encodeURIComponent(token)}`;
  const dashboardInboxUrl = `${base}/dashboard/inbox`;
  const plan = planAssigned as AdminPlanAssignment;

  await loopsSendAffiliateInvitationEmail({
    inviteeEmail: normalizedInviteeEmail,
    affiliateName,
    planAssigned,
    planLabel: labelForAdminPlanAssignment(plan),
    affiliateEndsAt: endsAtDate.toLocaleDateString(undefined, {
      dateStyle: "long",
    }),
    inviteExpiresInDays,
    inviteExpiresAt: inviteExpiresAt.toLocaleDateString(undefined, {
      dateStyle: "long",
    }),
    inviterName: callerName,
    acceptAffiliateUrl,
    dashboardInboxUrl,
    subjectLine: `You're invited as a Flipvise affiliate — ${affiliateName}`,
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

  if (isAffiliateInviteExpired(affiliate.inviteExpiresAt)) {
    throw new Error(
      "This invite link has expired. Ask your affiliate manager to send a new invite.",
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
  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard");
}

// ─── Edit ─────────────────────────────────────────────────────────────────────

const updateAffiliateSchema = z.object({
  affiliateId: z.number().int().positive(),
  affiliateName: z.string().min(1).max(255),
  invitedEmail: z.string().email(),
  planAssigned: z.string().refine(isAdminPlanAssignment, "Invalid plan"),
  endsAt: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid date"),
  /** When the row is still pending, resets the accept link deadline from “now” using this many days. */
  inviteExpiresInDays: z.number().int().min(1).max(365).optional(),
});

export type UpdateAffiliateInput = z.infer<typeof updateAffiliateSchema>;

async function clearAffiliateInboxUnreadForInvitee(
  affiliateId: number,
  invitedEmailNorm: string,
  invitedUserId: string | null,
): Promise<void> {
  const userIds = new Set<string>();
  if (invitedUserId) userIds.add(invitedUserId);
  const resolved = await findClerkUserIdByEmail(invitedEmailNorm);
  if (resolved) userIds.add(resolved);
  const itemId = String(affiliateId);
  for (const uid of userIds) {
    await deleteInboxReadForUserItem(uid, "affiliate", itemId);
  }
}

async function clearAffiliateExpiredInboxNoticeRead(
  affiliateId: number,
  invitedEmailNorm: string,
  invitedUserId: string | null,
): Promise<void> {
  const itemId = `expired-${affiliateId}`;
  const userIds = new Set<string>();
  if (invitedUserId) userIds.add(invitedUserId);
  const resolved = await findClerkUserIdByEmail(invitedEmailNorm);
  if (resolved) userIds.add(resolved);
  for (const uid of userIds) {
    await deleteInboxReadForUserItem(uid, "affiliate_notice", itemId);
  }
}

export async function updateAffiliateAction(data: UpdateAffiliateInput) {
  const { callerName } = await requirePlatformAdminActor();

  const parsed = updateAffiliateSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input: " + parsed.error.message);

  const { affiliateId, affiliateName, invitedEmail, planAssigned, endsAt, inviteExpiresInDays } =
    parsed.data;

  const normalizedInviteeEmail = invitedEmail.trim().toLowerCase();
  const newEndsAtDate = new Date(endsAt);
  if (newEndsAtDate <= new Date()) {
    throw new Error("End date must be in the future");
  }

  const existing = await getAffiliateById(affiliateId);
  if (!existing) throw new Error("Affiliate not found");
  if (existing.status === "revoked") throw new Error("Cannot edit a revoked affiliate");

  const emailChanged = normalizedInviteeEmail !== existing.invitedEmail.toLowerCase();

  const newClerkUserId = emailChanged
    ? await findClerkUserIdByEmail(normalizedInviteeEmail)
    : existing.invitedUserId ?? null;

  if (emailChanged && existing.invitedUserId && existing.status === "active") {
    await applyAffiliatePlanToClerk(existing.invitedUserId, "free");
  }

  const inviteWasExpired =
    existing.status === "pending" &&
    isAffiliateInviteExpired(existing.inviteExpiresAt);

  const newToken =
    existing.status === "pending" && inviteWasExpired
      ? randomBytes(32).toString("hex")
      : undefined;

  await updateAffiliateById(affiliateId, {
    affiliateName,
    invitedEmail: normalizedInviteeEmail,
    planAssigned,
    endsAt: newEndsAtDate,
    invitedUserId: emailChanged ? newClerkUserId : undefined,
    ...(existing.status === "pending"
      ? {
          inviteExpiresAt: computeAffiliateInviteExpiresAtFromDays(
            inviteExpiresInDays ?? getAffiliateInviteExpiryDays(),
          ),
        }
      : {}),
    ...(newToken !== undefined ? { token: newToken } : {}),
  });

  const updated = await getAffiliateById(affiliateId);
  if (!updated) throw new Error("Affiliate not found");

  if (existing.status === "active" && newClerkUserId) {
    await applyAffiliatePlanToClerk(
      newClerkUserId,
      planAssigned as AdminPlanAssignment,
    );
  }

  const base = resolveAppUrl();
  const dashboardInboxUrl = `${base}/dashboard/inbox`;

  if (existing.status === "pending" && inviteWasExpired && updated.token) {
    const plan = updated.planAssigned as AdminPlanAssignment;
    const daysUsed = inviteExpiresInDays ?? getAffiliateInviteExpiryDays();
    await loopsSendAffiliateInvitationEmail({
      inviteeEmail: normalizedInviteeEmail,
      affiliateName: updated.affiliateName,
      planAssigned: updated.planAssigned,
      planLabel: labelForAdminPlanAssignment(plan),
      affiliateEndsAt: updated.endsAt.toLocaleDateString(undefined, { dateStyle: "long" }),
      inviteExpiresInDays: daysUsed,
      inviteExpiresAt: updated.inviteExpiresAt.toLocaleDateString(undefined, {
        dateStyle: "long",
      }),
      inviterName: callerName,
      acceptAffiliateUrl: `${base}/affiliate/accept?token=${encodeURIComponent(updated.token)}`,
      dashboardInboxUrl,
      subjectLine: `You're invited as a Flipvise affiliate — ${updated.affiliateName}`,
    });
    await clearAffiliateInboxUnreadForInvitee(
      affiliateId,
      normalizedInviteeEmail,
      updated.invitedUserId,
    );
  }

  const endsAtChanged = existing.endsAt.getTime() !== updated.endsAt.getTime();
  const planChanged = existing.planAssigned !== updated.planAssigned;
  if (existing.status === "active" && (endsAtChanged || planChanged)) {
    const plan = updated.planAssigned as AdminPlanAssignment;
    await loopsSendAffiliateArrangementUpdateEmail({
      inviteeEmail: normalizedInviteeEmail,
      affiliateName: updated.affiliateName,
      planAssigned: updated.planAssigned,
      planLabel: labelForAdminPlanAssignment(plan),
      affiliateEndsAt: updated.endsAt.toLocaleDateString(undefined, { dateStyle: "long" }),
      previousAffiliateEndsAt: existing.endsAt.toLocaleDateString(undefined, {
        dateStyle: "long",
      }),
      inviterName: callerName,
      dashboardInboxUrl,
      subjectLine: "Your Flipvise affiliate arrangement was updated",
    });
    await clearAffiliateInboxUnreadForInvitee(
      affiliateId,
      normalizedInviteeEmail,
      updated.invitedUserId,
    );
  }

  if (updated.status === "active" && updated.endsAt.getTime() > Date.now()) {
    await clearAffiliateExpiredInboxNoticeRead(
      affiliateId,
      existing.invitedEmail.toLowerCase(),
      existing.invitedUserId,
    );
    await clearAffiliateExpiredInboxNoticeRead(
      affiliateId,
      normalizedInviteeEmail,
      updated.invitedUserId,
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/marketing-affiliates");
  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard");
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
  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard");
}
