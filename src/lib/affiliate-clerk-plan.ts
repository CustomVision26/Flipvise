import { createClerkClient } from "@clerk/backend";
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

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

/** Apply or clear an affiliate / admin-assigned plan on Clerk public metadata. */
export async function applyAffiliatePlanToClerkUser(
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

export function affiliatePlanSlugToAssignment(
  planSlug: string,
): AdminPlanAssignment | null {
  return isAdminPlanAssignment(planSlug) ? planSlug : null;
}
