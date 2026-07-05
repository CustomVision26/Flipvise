import { cache } from "react";
import { createClerkClient } from "@clerk/backend";
import { listAffiliatesForPlanHistory } from "@/db/queries/affiliates";
import { getActiveStripeSubscription } from "@/db/queries/stripe-subscriptions";
import { resolveActiveAffiliateGrant } from "@/lib/billing-tab-plan-display";
import { isClerkPlatformAdminRole } from "@/lib/clerk-platform-admin-role";
import { isPlatformSuperadminAllowListed } from "@/lib/platform-superadmin";
import {
  metadataPlanSlugFromPublicMeta,
  resolveEffectivePlan,
  resolvePersonalPlanMetadataVsBilling,
} from "@/lib/plan-metadata-billing-resolution";
import {
  canonicalEducationPlanId,
  isEducationTeamPlanId,
  type EducationTeamPlanId,
} from "@/lib/education-plans";
import {
  canonicalTeamPlanId,
  isTeamPlanId,
  type TeamPlanId,
} from "@/lib/team-plans";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

const noopHas = () => false;

/**
 * Active team-tier personal plan for a subscriber (workspace owner), aligned with
 * `getAccessContext().activeTeamPlan` but without the viewer's session JWT.
 */
export const resolveSubscriberActiveTeamPlan = cache(
  async (subscriberUserId: string): Promise<TeamPlanId | null> => {
    if (isPlatformSuperadminAllowListed(subscriberUserId)) {
      return null;
    }

    let meta: Record<string, unknown> = {};
    let primaryEmail: string | null = null;
    try {
      const user = await clerkClient.users.getUser(subscriberUserId);
      meta = (user.publicMetadata ?? {}) as Record<string, unknown>;
      primaryEmail = user.primaryEmailAddress?.emailAddress?.trim() ?? null;
      const role = typeof meta.role === "string" ? meta.role : null;
      if (isClerkPlatformAdminRole(role) || meta.adminGranted === true) {
        return null;
      }
    } catch {
      return null;
    }

    const affiliates = await listAffiliatesForPlanHistory(
      subscriberUserId,
      primaryEmail?.toLowerCase() ?? null,
    );
    const grant = resolveActiveAffiliateGrant(affiliates);
    if (grant) {
      const slug = canonicalTeamPlanId(grant.planSlug) ?? grant.planSlug;
      if (isTeamPlanId(slug)) {
        return canonicalTeamPlanId(slug)!;
      }
    }

    const planResolution = await resolvePersonalPlanMetadataVsBilling({
      clerkClient,
      userId: subscriberUserId,
      has: noopHas,
      publicMetadata: meta,
      stripeDbPlanSlug:
        (await getActiveStripeSubscription(subscriberUserId))?.planSlug ?? null,
    });

    if (planResolution.activeTeamPlan !== null) {
      return planResolution.activeTeamPlan;
    }

    const metadataForcedPersonalFree =
      planResolution.winner === "metadata" &&
      metadataPlanSlugFromPublicMeta(meta) == null;

    if (!metadataForcedPersonalFree) {
      const rawBillingPlan =
        typeof meta.billingPlan === "string"
          ? meta.billingPlan.trim() || null
          : null;
      const rawBillingStatus =
        typeof meta.billingStatus === "string" ? meta.billingStatus : null;
      const isBillingActiveRaw =
        rawBillingStatus === "active" || rawBillingStatus === "trialing";
      if (isBillingActiveRaw && rawBillingPlan && isTeamPlanId(rawBillingPlan)) {
        return canonicalTeamPlanId(rawBillingPlan)!;
      }
    }

    const effective = resolveEffectivePlan(meta);
    if (effective && isTeamPlanId(effective)) {
      return canonicalTeamPlanId(effective)!;
    }

    return null;
  },
);

export const resolveSubscriberActiveEducationTeamPlan = cache(
  async (subscriberUserId: string): Promise<EducationTeamPlanId | null> => {
    if (isPlatformSuperadminAllowListed(subscriberUserId)) {
      return null;
    }

    let meta: Record<string, unknown> = {};
    let primaryEmail: string | null = null;
    try {
      const user = await clerkClient.users.getUser(subscriberUserId);
      meta = (user.publicMetadata ?? {}) as Record<string, unknown>;
      primaryEmail = user.primaryEmailAddress?.emailAddress?.trim() ?? null;
      const role = typeof meta.role === "string" ? meta.role : null;
      if (isClerkPlatformAdminRole(role) || meta.adminGranted === true) {
        return null;
      }
    } catch {
      return null;
    }

    const stripeSub = await getActiveStripeSubscription(subscriberUserId);
    const stripeSlug = stripeSub?.planSlug?.trim();
    if (stripeSlug && isEducationTeamPlanId(stripeSlug)) {
      return canonicalEducationPlanId(stripeSlug) as EducationTeamPlanId;
    }

    const affiliates = await listAffiliatesForPlanHistory(
      subscriberUserId,
      primaryEmail?.toLowerCase() ?? null,
    );
    const grant = resolveActiveAffiliateGrant(affiliates);
    if (grant) {
      const slug = canonicalEducationPlanId(grant.planSlug);
      if (slug && isEducationTeamPlanId(slug)) return slug;
    }

    const planResolution = await resolvePersonalPlanMetadataVsBilling({
      clerkClient,
      userId: subscriberUserId,
      has: noopHas,
      publicMetadata: meta,
      stripeDbPlanSlug: stripeSlug ?? null,
    });

    const resolutionSlug = coalesceEducationTeamSlug(
      planResolution.effectiveStripeSlug,
      typeof meta.billingPlan === "string" ? meta.billingPlan : null,
      resolveEffectivePlan(meta),
    );
    if (resolutionSlug) return resolutionSlug;

    return null;
  },
);

function coalesceEducationTeamSlug(
  ...candidates: (string | null | undefined)[]
): EducationTeamPlanId | null {
  for (const raw of candidates) {
    if (typeof raw !== "string") continue;
    const slug = canonicalEducationPlanId(raw.trim());
    if (slug && isEducationTeamPlanId(slug)) return slug;
  }
  return null;
}

/** Active consumer or education team-tier plan for a workspace owner. */
export async function resolveSubscriberActiveWorkspacePlan(
  subscriberUserId: string,
): Promise<string | null> {
  const teamPlan = await resolveSubscriberActiveTeamPlan(subscriberUserId);
  if (teamPlan) return teamPlan;
  return resolveSubscriberActiveEducationTeamPlan(subscriberUserId);
}

export async function subscriberHasActiveWorkspacePlan(
  subscriberUserId: string,
): Promise<boolean> {
  return (await resolveSubscriberActiveWorkspacePlan(subscriberUserId)) !== null;
}

export async function subscriberHasActiveTeamTierPlan(
  subscriberUserId: string,
): Promise<boolean> {
  return (await resolveSubscriberActiveWorkspacePlan(subscriberUserId)) !== null;
}
