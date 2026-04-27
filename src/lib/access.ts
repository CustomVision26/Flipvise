import { auth } from "@/lib/clerk-auth";
import { createClerkClient } from "@clerk/backend";
import { proBillingFeatureBundleSatisfied } from "@/lib/pro-billing-feature-bundle";
import { isPlatformSuperadminAllowListed } from "@/lib/platform-superadmin";
import { TEAM_PLAN_IDS, isTeamPlanId, type TeamPlanId } from "@/lib/team-plans";
import {
  metadataPlanSlugFromPublicMeta,
  resolvePersonalPlanMetadataVsBilling,
  type PlanPublicMetadata,
} from "@/lib/plan-metadata-billing-resolution";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

type PublicMeta = PlanPublicMetadata & {
  role?: string;
  adminGranted?: boolean;
  /** Written when admin is granted; used to restore `adminGranted` after admin is removed. */
  preAdminGrantSnapshot?: { adminGranted: boolean };
};

/**
 * Returns the full access context for the current user, combining Clerk
 * Billing subscriptions, admin-granted Pro access, and the admin role itself.
 *
 * Admin accounts receive all Pro features automatically — no manual grant
 * or active subscription is required.
 *
 * Personal Pro vs Free also reconciles `publicMetadata` (admin "Assign plan")
 * with Clerk Billing using `planSourceUpdatedAt` vs subscription timestamps.
 */
function resolveActiveTeamPlan(
  has: (a: { plan: string } | { feature: string }) => boolean | undefined,
): TeamPlanId | null {
  for (const plan of TEAM_PLAN_IDS) {
    if (has({ plan })) return plan;
  }
  return null;
}

export async function getAccessContext() {
  const { userId, has } = await auth();

  if (!userId) {
    return {
      userId: null as null,
      isPro: false,
      hasUnlimitedDecks: false,
      hasAI: false,
      has75CardsPerDeck: false,
      hasPrioritySupport: false,
      hasCustomColors: false,
      adminGranted: false,
      isAdmin: false,
      isSuperadmin: false,
      activeTeamPlan: null as TeamPlanId | null,
      /** Clerk Billing personal `pro` plan — distinct from team-tier plans. */
      hasClerkPersonalPro: false,
    };
  }

  const superadminAllowListed = isPlatformSuperadminAllowListed(userId);

  const user = await clerkClient.users.getUser(userId);
  const meta = user.publicMetadata as PublicMeta;
  const planResolution = await resolvePersonalPlanMetadataVsBilling({
    clerkClient,
    userId,
    has,
    publicMetadata: meta,
  });

  const metadataForcedPersonalFree =
    planResolution.winner === "metadata" &&
    metadataPlanSlugFromPublicMeta(meta) == null;

  const paidProFromHas = has({ plan: "pro" });
  const paidUnlimitedDecks = has({ feature: "unlimited_decks" });
  const paidAI = has({ feature: "ai_flashcard_generation" });
  const paid75Cards = has({ feature: "75_cards_per_deck" });
  const paidPrioritySupport = has({ feature: "priority_support" });
  const paidCustomColors = has({ feature: "12_interface_colors" });
  const proFeatureBundle = proBillingFeatureBundleSatisfied(has);

  const liveRole = meta?.role;
  const isSuperadminUser = liveRole === "superadmin";
  const isSuperadmin = superadminAllowListed || isSuperadminUser;
  const isAdmin = liveRole === "admin" || isSuperadminUser || superadminAllowListed;
  const adminGranted = meta?.adminGranted === true;
  const unlocked = isAdmin || adminGranted;

  const effectiveTeamPlan = planResolution.activeTeamPlan;
  const effectivePersonalPro =
    planResolution.personalPro && effectiveTeamPlan === null;

  const jwtTeamPlan = resolveActiveTeamPlan(has);

  const teamPlanForFeatures =
    planResolution.winner === "metadata"
      ? planResolution.activeTeamPlan
      : planResolution.activeTeamPlan !== null
        ? planResolution.activeTeamPlan
        : jwtTeamPlan;

  // Platform admins automatically receive every Pro feature.
  if (unlocked) {
    return {
      userId,
      isPro: true,
      hasUnlimitedDecks: true,
      hasAI: true,
      has75CardsPerDeck: true,
      hasPrioritySupport: true,
      hasCustomColors: true,
      adminGranted,
      isAdmin,
      isSuperadmin,
      activeTeamPlan: teamPlanForFeatures,
      hasClerkPersonalPro: paidProFromHas,
    };
  }

  // Team-tier workspace: JWT can lag; when Billing API wins, merge subscription slug with JWT.
  if (teamPlanForFeatures !== null && !superadminAllowListed) {
    return {
      userId,
      isPro: true,
      hasUnlimitedDecks: true,
      hasAI: true,
      has75CardsPerDeck: true,
      hasPrioritySupport: true,
      hasCustomColors: true,
      adminGranted: false,
      isAdmin: false,
      isSuperadmin: false,
      activeTeamPlan: teamPlanForFeatures,
      hasClerkPersonalPro: paidProFromHas,
    };
  }

  const billingApiDrovePersonalPro =
    planResolution.comparedMetadataToBilling &&
    planResolution.winner === "billing" &&
    effectivePersonalPro &&
    !planResolution.billingJwtPersonalPro;

  const metadataDrovePersonalPro =
    planResolution.winner === "metadata" || planResolution.legacyMetadataOverride;

  const jwtPersonalProFullBundle =
    proFeatureBundle && planResolution.billingJwtPersonalPro;

  if (effectivePersonalPro && !superadminAllowListed) {
    const grantFullPersonalPro =
      jwtPersonalProFullBundle ||
      metadataDrovePersonalPro ||
      billingApiDrovePersonalPro;

    if (grantFullPersonalPro) {
      return {
        userId,
        isPro: true,
        hasUnlimitedDecks: true,
        hasAI: true,
        has75CardsPerDeck: true,
        hasPrioritySupport: true,
        hasCustomColors: true,
        adminGranted: false,
        isAdmin: false,
        isSuperadmin: false,
        activeTeamPlan: null,
        hasClerkPersonalPro: planResolution.billingJwtPersonalPro,
      };
    }
  }

  // Billing metadata fallback: when plan/teamPlanId were not propagated to metadata
  // (e.g. webhook set billingPlan/billingStatus but the resolved computed fields are absent),
  // read the Stripe-sourced fields directly so team-tier subscribers always get their
  // correct access level on the personal workspace. Only applies when the primary
  // resolution path found no paid plan and no admin override forced free.
  if (!unlocked && !metadataForcedPersonalFree && !superadminAllowListed) {
    const rawBillingPlan =
      typeof meta.billingPlan === "string" ? meta.billingPlan.trim() || null : null;
    const rawBillingStatus =
      typeof meta.billingStatus === "string" ? meta.billingStatus : null;
    const isBillingActiveRaw =
      rawBillingStatus === "active" || rawBillingStatus === "trialing";

    if (isBillingActiveRaw && rawBillingPlan !== null) {
      if (isTeamPlanId(rawBillingPlan)) {
        return {
          userId,
          isPro: true,
          hasUnlimitedDecks: true,
          hasAI: true,
          has75CardsPerDeck: true,
          hasPrioritySupport: true,
          hasCustomColors: true,
          adminGranted: false,
          isAdmin: false,
          isSuperadmin: false,
          activeTeamPlan: rawBillingPlan as TeamPlanId,
          hasClerkPersonalPro: paidProFromHas,
        };
      }
      if (rawBillingPlan === "pro") {
        return {
          userId,
          isPro: true,
          hasUnlimitedDecks: true,
          hasAI: true,
          has75CardsPerDeck: true,
          hasPrioritySupport: true,
          hasCustomColors: true,
          adminGranted: false,
          isAdmin: false,
          isSuperadmin: false,
          activeTeamPlan: null,
          hasClerkPersonalPro: planResolution.billingJwtPersonalPro,
        };
      }
    }
  }

  const jwtPaid = !metadataForcedPersonalFree;

  return {
    userId,
    isPro: (jwtPaid ? paidProFromHas : false) || unlocked,
    hasUnlimitedDecks: (jwtPaid ? paidUnlimitedDecks : false) || unlocked,
    hasAI: (jwtPaid ? paidAI : false) || unlocked,
    has75CardsPerDeck: (jwtPaid ? paid75Cards : false) || unlocked,
    hasPrioritySupport: (jwtPaid ? paidPrioritySupport : false) || unlocked,
    hasCustomColors: (jwtPaid ? paidCustomColors : false) || unlocked,
    adminGranted,
    isAdmin,
    isSuperadmin,
    activeTeamPlan: null,
    hasClerkPersonalPro: jwtPaid && paidProFromHas,
  };
}
