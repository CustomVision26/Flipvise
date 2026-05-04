"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClerkClient } from "@clerk/backend";
import { auth } from "@/lib/clerk-auth";
import { isAdminPlanAssignment, type AdminPlanAssignment } from "@/lib/admin-assignable-plans";
import { applyPlanUpgrade } from "@/lib/apply-plan-upgrade";
import {
  getPendingAdminPlanInviteForUser,
  markAdminPlanInviteAccepted,
  markAdminPlanInviteDeclined,
} from "@/db/queries/admin-plan-invites";
import { logAdminPlanAssignment } from "@/db/queries/admin";
import { markInboxItemRead } from "@/db/queries/inbox-reads";
import { isTeamPlanId, TEAM_PLAN_LABELS, type TeamPlanId } from "@/lib/team-plans";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

const acceptDeclineSchema = z.object({
  inviteId: z.number().int().positive(),
});

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

export async function acceptAdminPlanInviteAction(data: z.infer<typeof acceptDeclineSchema>) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = acceptDeclineSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const invite = await getPendingAdminPlanInviteForUser(parsed.data.inviteId, userId);
  if (!invite) throw new Error("This request is no longer available or was already handled.");

  if (!isAdminPlanAssignment(invite.assignment)) {
    throw new Error("Invalid plan on this request");
  }
  const assignment = invite.assignment as AdminPlanAssignment;

  const target = await clerkClient.users.getUser(userId);
  const targetName =
    [target.firstName, target.lastName].filter(Boolean).join(" ") ||
    target.username ||
    userId;
  const targetEmail =
    target.emailAddresses.find((e) => e.id === target.primaryEmailAddressId)?.emailAddress ??
    null;
  const targetMeta = target.publicMetadata as Record<string, unknown>;
  const previousSlug = previousPlanSlugFromMeta(targetMeta);

  const planResult = await applyPlanUpgrade(userId, assignment);

  await logAdminPlanAssignment({
    targetUserId: userId,
    targetUserName: targetName,
    targetUserEmail: targetEmail,
    action: assignment === "free" ? "plan_removed" : "plan_assigned",
    planName: planSlugToDisplayName(assignment),
    previousPlanName: planSlugToDisplayName(previousSlug),
    assignedByUserId: invite.assignedByUserId,
    assignedByName: invite.assignedByName,
    planApplicationPath: planResult.path,
  });

  await markAdminPlanInviteAccepted(invite.id, userId);

  await markInboxItemRead(userId, "admin_plan_invite", String(invite.id));

  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard");
  revalidatePath("/admin");
}

export async function declineAdminPlanInviteAction(data: z.infer<typeof acceptDeclineSchema>) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = acceptDeclineSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const ok = await markAdminPlanInviteDeclined(parsed.data.inviteId, userId);
  if (!ok) throw new Error("This request is no longer available or was already handled.");

  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard");
}
