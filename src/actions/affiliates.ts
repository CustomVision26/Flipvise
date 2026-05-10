"use server";

import { auth } from "@/lib/clerk-auth";
import { createClerkClient } from "@clerk/backend";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { z } from "zod";
import {
  insertAffiliate,
  commitAffiliateConfirmedArrangementChange,
  allocateUniqueAffiliatePromotionalCode,
  listAffiliatesMatchingInviteEmail,
  revokeAffiliateById,
  getAffiliateById,
  updateAffiliateById,
  getAffiliateByToken,
  getAffiliateByArrangementChangeToken,
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
import { resolveAffiliateInviteEmailConflict } from "@/lib/affiliate-invite-email-conflict";

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

    const requestedNorm = parsed.data.email.trim().toLowerCase();
    const fullNameFromClerk = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    const rawUsername = (user.username ?? "").trim();
    const usernameLooksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawUsername);
    /** Avoid using the invite address (or duplicate of it) as a “display name”. */
    const usernameIsDistinct =
      rawUsername &&
      !usernameLooksLikeEmail &&
      rawUsername.toLowerCase() !== requestedNorm;

    let name = fullNameFromClerk || (usernameIsDistinct ? rawUsername : "");
    const trimmedCandidate = name.trim();
    const candidateIsDupEmail =
      trimmedCandidate &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedCandidate) &&
      trimmedCandidate.toLowerCase() === requestedNorm;
    if (candidateIsDupEmail) {
      name = "";
    }

    return { found: true, name: name.trim(), currentPlan: planLabel };
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

  const duplicates = await listAffiliatesMatchingInviteEmail(normalizedInviteeEmail);
  const inviteConflictResolved = resolveAffiliateInviteEmailConflict(duplicates);
  if (inviteConflictResolved) {
    throw new Error(`${inviteConflictResolved.title} ${inviteConflictResolved.detail}`);
  }

  // Resolve Clerk user for this email (may not exist yet)
  const invitedUserId = await findClerkUserIdByEmail(normalizedInviteeEmail);

  // Generate a secure URL-safe token for the accept link
  const token = randomBytes(32).toString("hex");
  const inviteExpiresAt = computeAffiliateInviteExpiresAtFromDays(inviteExpiresInDays);

  const promotionalCode = await allocateUniqueAffiliatePromotionalCode(affiliateName);

  /** Registered Clerk user → invitation via app inbox only (no Loops transactional). */
  const registeredClerkInvitee = Boolean(invitedUserId);

  // Persist the affiliate as PENDING — plan is NOT applied until accepted
  const affiliateId = await insertAffiliate({
    invitedEmail: normalizedInviteeEmail,
    invitedUserId,
    affiliateName,
    planAssigned,
    endsAt: endsAtDate,
    inviteExpiresAt,
    addedByUserId: userId,
    addedByName: callerName,
    token,
    promotionalCode,
    status: "pending",
  });
  if (!affiliateId) throw new Error("Could not save affiliate invitation");

  const base = resolveAppUrl();
  const acceptAffiliateUrl = `${base}/affiliate/accept?token=${encodeURIComponent(token)}`;
  const dashboardInboxUrl = `${base}/dashboard/inbox`;
  const plan = planAssigned as AdminPlanAssignment;

  if (!registeredClerkInvitee) {
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
  }

  await clearAffiliateInboxUnreadForInvitee(
    affiliateId,
    normalizedInviteeEmail,
    invitedUserId,
  );

  revalidatePath("/admin");
  revalidatePath("/admin/marketing-affiliates");
  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard");
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

const acceptAffiliateArrangementChangeSchema = z.object({
  token: z.string().min(1),
});
export type AcceptAffiliateArrangementChangeInput = z.infer<
  typeof acceptAffiliateArrangementChangeSchema
>;

/** Applies staged plan/end-date after the affiliate confirms via link or inbox. */
export async function acceptAffiliateArrangementChangeAction(
  data: AcceptAffiliateArrangementChangeInput,
) {
  const { userId } = await auth();
  if (!userId) throw new Error("You must be signed in to confirm this update");

  const parsed = acceptAffiliateArrangementChangeSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid token");

  const affiliate = await getAffiliateByArrangementChangeToken(parsed.data.token);
  if (!affiliate) throw new Error("Confirmation link is invalid or was already used");
  if (affiliate.status !== "active") {
    throw new Error("This arrangement is no longer active");
  }
  if (!affiliate.pendingPlanAssigned || !affiliate.pendingEndsAt) {
    throw new Error("There is no pending change to confirm");
  }
  if (!affiliate.arrangementChangeExpiresAt) {
    throw new Error("Confirmation link is invalid");
  }
  if (affiliate.arrangementChangeExpiresAt.getTime() < Date.now()) {
    throw new Error(
      "This confirmation link has expired. Ask your affiliate manager to send an updated arrangement.",
    );
  }

  const clerkUser = await clerkClient.users.getUser(userId);
  const userEmails = clerkUser.emailAddresses.map((e) => e.emailAddress.toLowerCase());
  if (!userEmails.includes(affiliate.invitedEmail.toLowerCase())) {
    throw new Error(
      "This update was proposed for a different email address. " +
        "Please sign in with the account that matches " +
        affiliate.invitedEmail,
    );
  }

  if (!isAdminPlanAssignment(affiliate.pendingPlanAssigned)) {
    throw new Error("Invalid pending arrangement data");
  }

  const pendingPlan = affiliate.pendingPlanAssigned as AdminPlanAssignment;

  await commitAffiliateConfirmedArrangementChange(
    affiliate.id,
    affiliate.pendingPlanAssigned,
    affiliate.pendingEndsAt,
  );

  await applyPlanUpgrade(userId, pendingPlan);

  revalidatePath("/dashboard/inbox");
  revalidatePath("/affiliate/confirm-arrangement");
  revalidatePath("/dashboard");
}

// ─── Cancel pending invite ────────────────────────────────────────────────────

const cancelAffiliateSchema = z.object({ affiliateId: z.number().int().positive() });
export type CancelAffiliateInput = z.infer<typeof cancelAffiliateSchema>;

export async function cancelAffiliateInviteAction(data: CancelAffiliateInput) {
  await requirePlatformAdminActor();

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
  /** When pending, mirrors the “Accept link expires in (days)” value when the modal opened — used to rotate token only when needed. */
  previousInviteExpiresInDays: z.number().int().min(1).max(365).optional(),
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

  const { affiliateId, affiliateName, invitedEmail, planAssigned, endsAt, inviteExpiresInDays, previousInviteExpiresInDays } =
    parsed.data;

  const normalizedInviteeEmail = invitedEmail.trim().toLowerCase();

  const existing = await getAffiliateById(affiliateId);
  if (!existing) throw new Error("Affiliate not found");
  if (existing.status === "revoked") throw new Error("Cannot edit a revoked affiliate");

  /** Active affiliates cannot change identity from this UI; server-enforced per row. */
  const lockedActiveIdentity = existing.status === "active";
  const resolvedAffiliateName = lockedActiveIdentity
    ? existing.affiliateName
    : affiliateName.trim();
  const resolvedInviteeEmailNorm = lockedActiveIdentity
    ? existing.invitedEmail.trim().toLowerCase()
    : normalizedInviteeEmail;

  if (!resolvedAffiliateName) {
    throw new Error("Affiliate name is required");
  }

  const newEndsAtDate = new Date(endsAt);
  if (newEndsAtDate <= new Date()) {
    throw new Error("End date must be in the future");
  }

  const proposedPlan = planAssigned as AdminPlanAssignment;

  const emailChanged = resolvedInviteeEmailNorm !== existing.invitedEmail.toLowerCase();

  const newClerkUserId = emailChanged
    ? await findClerkUserIdByEmail(resolvedInviteeEmailNorm)
    : existing.invitedUserId ?? null;

  if (emailChanged && existing.invitedUserId && existing.status === "active") {
    await applyAffiliatePlanToClerk(existing.invitedUserId, "free");
  }

  const substantiveArrangementChange =
    planAssigned !== existing.planAssigned ||
    newEndsAtDate.getTime() !== existing.endsAt.getTime();

  const deferActiveArrangementConfirmation =
    existing.status === "active" && substantiveArrangementChange;

  const base = resolveAppUrl();
  const dashboardInboxUrl = `${base}/dashboard/inbox`;

  if (deferActiveArrangementConfirmation) {
    const arrangementToken = randomBytes(32).toString("hex");
    const arrangementExpiry = computeAffiliateInviteExpiresAtFromDays(
      getAffiliateInviteExpiryDays(),
    );

    const arrangementUpdated = await updateAffiliateById(
      affiliateId,
      {
        affiliateName: resolvedAffiliateName,
        invitedEmail: resolvedInviteeEmailNorm,
        planAssigned: existing.planAssigned,
        endsAt: existing.endsAt,
        invitedUserId: emailChanged ? newClerkUserId : undefined,
        pendingPlanAssigned: planAssigned,
        pendingEndsAt: newEndsAtDate,
        arrangementChangeToken: arrangementToken,
        arrangementChangeExpiresAt: arrangementExpiry,
      },
      { onlyIfStatus: "active" },
    );
    if (!arrangementUpdated) {
      throw new Error(
        "Could not save this arrangement proposal — the affiliate may have changed. Refresh Marketing Affiliates.",
      );
    }

    const updated = await getAffiliateById(affiliateId);
    if (!updated) throw new Error("Affiliate not found");

    await clearAffiliateInboxUnreadForInvitee(
      affiliateId,
      resolvedInviteeEmailNorm,
      updated.invitedUserId,
    );

    if (updated.status === "active" && updated.endsAt.getTime() > Date.now()) {
      await clearAffiliateExpiredInboxNoticeRead(
        affiliateId,
        existing.invitedEmail.toLowerCase(),
        existing.invitedUserId,
      );
      await clearAffiliateExpiredInboxNoticeRead(
        affiliateId,
        resolvedInviteeEmailNorm,
        updated.invitedUserId,
      );
    }

    revalidatePath("/admin");
    revalidatePath("/admin/marketing-affiliates");
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard");
    return;
  }

  const inviteWasExpired =
    existing.status === "pending" &&
    isAffiliateInviteExpired(existing.inviteExpiresAt);

  const inviteExpiryDaysChanged =
    existing.status === "pending" &&
    inviteExpiresInDays != null &&
    previousInviteExpiresInDays != null &&
    inviteExpiresInDays !== previousInviteExpiresInDays;

  const pendingInviteDetailsChanged =
    existing.status === "pending" &&
    (planAssigned !== existing.planAssigned ||
      newEndsAtDate.getTime() !== existing.endsAt.getTime() ||
      resolvedInviteeEmailNorm !== existing.invitedEmail.trim().toLowerCase() ||
      inviteExpiryDaysChanged);

  /** Invalidate the previous accept URL when the pending proposal or expiry window materially changes. */
  const regeneratePendingInviteToken =
    existing.status === "pending" &&
    (inviteWasExpired || pendingInviteDetailsChanged);

  const newToken = regeneratePendingInviteToken ? randomBytes(32).toString("hex") : undefined;

  const statusGuard = existing.status === "pending" ? ("pending" as const) : ("active" as const);

  const rowUpdated = await updateAffiliateById(
    affiliateId,
    {
      affiliateName: resolvedAffiliateName,
      invitedEmail: resolvedInviteeEmailNorm,
      planAssigned,
      endsAt: newEndsAtDate,
      invitedUserId: emailChanged ? newClerkUserId : undefined,
      ...(existing.status === "pending"
        ? {
            ...(regeneratePendingInviteToken
              ? {
                  inviteExpiresAt: computeAffiliateInviteExpiresAtFromDays(
                    inviteExpiresInDays ?? getAffiliateInviteExpiryDays(),
                  ),
                }
              : {}),
          }
        : {}),
      ...(newToken !== undefined ? { token: newToken } : {}),
      ...(existing.status === "active"
        ? {
            pendingPlanAssigned: null,
            pendingEndsAt: null,
            arrangementChangeToken: null,
            arrangementChangeExpiresAt: null,
          }
        : {}),
    },
    { onlyIfStatus: statusGuard },
  );

  if (!rowUpdated) {
    if (existing.status === "pending") {
      throw new Error(
        "This invitation was already accepted before Save could finish. Reload Marketing Affiliates — nothing was emailed and these edits were not applied.",
      );
    }
    throw new Error(
      "Could not save — the affiliate may have been revoked. Refresh Marketing Affiliates.",
    );
  }

  const updated = await getAffiliateById(affiliateId);
  if (!updated) throw new Error("Affiliate not found");

  if (existing.status === "active" && newClerkUserId) {
    await applyAffiliatePlanToClerk(newClerkUserId, proposedPlan);
  }

  if (
    existing.status === "pending" &&
    regeneratePendingInviteToken &&
    updated.token
  ) {
    const inviteToken = updated.token;
    const plan = updated.planAssigned as AdminPlanAssignment;
    const daysUsed = inviteExpiresInDays ?? getAffiliateInviteExpiryDays();
    const inviteeResolvedClerkId =
      updated.invitedUserId ?? (await findClerkUserIdByEmail(resolvedInviteeEmailNorm));

    if (!inviteeResolvedClerkId) {
      await loopsSendAffiliateInvitationEmail({
        inviteeEmail: resolvedInviteeEmailNorm,
        affiliateName: updated.affiliateName,
        planAssigned: updated.planAssigned,
        planLabel: labelForAdminPlanAssignment(plan),
        affiliateEndsAt: updated.endsAt.toLocaleDateString(undefined, { dateStyle: "long" }),
        inviteExpiresInDays: daysUsed,
        inviteExpiresAt: updated.inviteExpiresAt.toLocaleDateString(undefined, {
          dateStyle: "long",
        }),
        inviterName: callerName,
        acceptAffiliateUrl: `${base}/affiliate/accept?token=${encodeURIComponent(inviteToken)}`,
        dashboardInboxUrl,
        subjectLine: `You're invited as a Flipvise affiliate — ${updated.affiliateName}`,
      });
    }

    await clearAffiliateInboxUnreadForInvitee(
      affiliateId,
      resolvedInviteeEmailNorm,
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
      resolvedInviteeEmailNorm,
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
