import { cache } from "react";
import { redirect } from "next/navigation";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { auth } from "@/lib/clerk-auth";
import {
  CLEAR_STALE_SESSION_PATH,
  isClerkUserNotFoundError,
} from "@/lib/clerk-stale-session";
import { createClerkClient } from "@clerk/backend";
import {
  legacyUnlimitedStyleProBundleSatisfied,
  proBillingFeatureBundleSatisfied,
} from "@/lib/pro-billing-feature-bundle";
import { isPlatformSuperadminAllowListed } from "@/lib/platform-superadmin";
import {
  canonicalTeamPlanId,
  resolveActiveTeamPlanFromHas,
  isTeamPlanId,
  type TeamPlanId,
} from "@/lib/team-plans";
import {
  FREE_PERSONAL_DECK_LIMIT,
  FREE_CARDS_PER_DECK_LIMIT,
  limitsForPersonalIndividualTier,
  proPlusPersonalLimits,
} from "@/lib/personal-plan-limits";
import {
  metadataPlanSlugFromPublicMeta,
  resolvePersonalPlanMetadataVsBilling,
  type PersonalPlanResolution,
  type PlanPublicMetadata,
} from "@/lib/plan-metadata-billing-resolution";
import { resolvePrioritySupportAccess } from "@/lib/priority-support-eligibility";
import { listAffiliatesForPlanHistory } from "@/db/queries/affiliates";
import { getActiveStripeSubscription } from "@/db/queries/stripe-subscriptions";
import { resolveActiveAffiliateGrant } from "@/lib/billing-tab-plan-display";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

type PublicMeta = PlanPublicMetadata & {
  role?: string;
  adminGranted?: boolean;
  /** Written when admin is granted; used to restore `adminGranted` after admin is removed. */
  preAdminGrantSnapshot?: { adminGranted: boolean };
};

export type AccessContext = {
  userId: string | null;
  isPro: boolean;
  /** Max personal (non-team-workspace) decks the user may create. */
  maxPersonalDecks: number;
  /** Max cards per deck on personal decks (team-tier decks use Pro Plus cap via {@link resolveDeckCardCap}). */
  maxCardsPerDeck: number;
  /** Legacy: true when personal deck cap is above the Free tier (paid / admin / team). */
  hasUnlimitedDecks: boolean;
  /** Legacy: true when card cap is above the Free tier. */
  has75CardsPerDeck: boolean;
  hasAI: boolean;
  /** Pro Plus semantic feature — text-to-speech / reading aids gated in UI. */
  hasAiReading: boolean;
  /** Pro Plus personal or team-tier plan only — not standard Pro. Platform admins included. */
  hasPrioritySupport: boolean;
  hasCustomColors: boolean;
  /**
   * When true, Interface background offers the full Pro Plus preset list (12); when false but {@link isPro}
   * is true, Pro tier presets only (8). Free users use the free-tier interface color list (3) instead.
   */
  hasProPlusInterfacePalette: boolean;
  adminGranted: boolean;
  isAdmin: boolean;
  isSuperadmin: boolean;
  activeTeamPlan: TeamPlanId | null;
  /** JWT carries individual `pro` (not Pro Plus). */
  hasClerkPersonalPro: boolean;
  /** JWT carries individual `pro_plus`. */
  hasClerkPersonalProPlus: boolean;
  /** Primary email from Clerk Backend `getUser` (same fetch as metadata). Used by layout for team-invite inbox count alongside broadcast unread queries. */
  primaryEmail: string | null;
};

function personalPaidSlugFromStripeSlug(
  slug: string | undefined | null,
): "pro" | "pro_plus" | null {
  if (slug === "pro" || slug === "pro_plus") return slug;
  return null;
}

function prioritySupportForAccess(input: {
  isPlatformAdmin: boolean;
  activeTeamPlan: TeamPlanId | null;
  personalPlanSlug: "pro" | "pro_plus" | null | undefined;
  hasClerkProPlusPlan: boolean;
}): boolean {
  return resolvePrioritySupportAccess({
    isPlatformAdmin: input.isPlatformAdmin,
    activeTeamPlan: input.activeTeamPlan,
    personalPlanSlug: input.personalPlanSlug ?? null,
    hasClerkProPlusPlan: input.hasClerkProPlusPlan,
  });
}

function personalWorkspaceLimits(input: {
  unlocked: boolean;
  activeTeamPlan: TeamPlanId | null;
  stripeSlug: string | undefined | null;
}): { maxPersonalDecks: number; maxCardsPerDeck: number } {
  if (input.unlocked || input.activeTeamPlan !== null) {
    return proPlusPersonalLimits();
  }
  const personal = personalPaidSlugFromStripeSlug(input.stripeSlug);
  if (personal === "pro_plus") return limitsForPersonalIndividualTier("pro_plus");
  if (personal === "pro") return limitsForPersonalIndividualTier("pro");
  return {
    maxPersonalDecks: FREE_PERSONAL_DECK_LIMIT,
    maxCardsPerDeck: FREE_CARDS_PER_DECK_LIMIT,
  };
}

function stripeSlugForPersonalTier(resolution: PersonalPlanResolution): string | undefined {
  if (resolution.activeTeamPlan !== null) return undefined;
  return resolution.effectiveStripeSlug;
}

function clerkApiStatus(error: unknown): number | null {
  if (!isClerkAPIResponseError(error)) return null;
  if ("status" in error && typeof error.status === "number") return error.status;
  if (
    "statusCode" in error &&
    typeof (error as { statusCode: unknown }).statusCode === "number"
  ) {
    return (error as { statusCode: number }).statusCode;
  }
  return null;
}

/** Clerk Backend outages we can survive by falling back to JWT session claims. */
function isClerkBackendDegradableError(error: unknown): boolean {
  if (!isClerkAPIResponseError(error)) return false;

  const status = clerkApiStatus(error);
  if (status === 429 || status === 502 || status === 503 || status === 504) return true;

  const msg = error.message.toLowerCase();
  if (
    msg.includes("too many requests") ||
    msg.includes("rate limit") ||
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout")
  ) {
    return true;
  }

  return (
    error.errors?.some((e) => {
      const code = (e.code ?? "").toLowerCase();
      const text = `${e.message ?? ""} ${e.longMessage ?? ""}`.toLowerCase();
      return (
        code === "unexpected_error" ||
        text.includes("fetch failed") ||
        text.includes("network") ||
        text.includes("timeout")
      );
    }) ?? false
  );
}

async function accessContextFromActiveAffiliateGrant(input: {
  userId: string;
  primaryEmail: string | null;
  paidProFromHas: boolean;
  paidProPlusFromHas: boolean;
  paidCustomColors: boolean;
  aiReadingForTier: (stripeSlug: string | undefined | null) => boolean;
}): Promise<AccessContext | null> {
  const affiliates = await listAffiliatesForPlanHistory(
    input.userId,
    input.primaryEmail?.toLowerCase() ?? null,
  );
  const grant = resolveActiveAffiliateGrant(affiliates);
  if (!grant) return null;

  const planSlug = canonicalTeamPlanId(grant.planSlug) ?? grant.planSlug;

  if (isTeamPlanId(planSlug)) {
    const teamPlan = canonicalTeamPlanId(planSlug)!;
    const lim = personalWorkspaceLimits({
      unlocked: false,
      activeTeamPlan: teamPlan,
      stripeSlug: undefined,
    });
    return {
      userId: input.userId,
      isPro: true,
      maxPersonalDecks: lim.maxPersonalDecks,
      maxCardsPerDeck: lim.maxCardsPerDeck,
      hasUnlimitedDecks: lim.maxPersonalDecks > FREE_PERSONAL_DECK_LIMIT,
      has75CardsPerDeck: lim.maxCardsPerDeck > FREE_CARDS_PER_DECK_LIMIT,
      hasAI: true,
      hasAiReading: true,
      hasPrioritySupport: true,
      hasCustomColors: true,
      hasProPlusInterfacePalette: true,
      adminGranted: false,
      isAdmin: false,
      isSuperadmin: false,
      activeTeamPlan: teamPlan,
      hasClerkPersonalPro: input.paidProFromHas,
      hasClerkPersonalProPlus: input.paidProPlusFromHas,
      primaryEmail: input.primaryEmail,
    };
  }

  if (planSlug === "pro" || planSlug === "pro_plus") {
    const lim = personalWorkspaceLimits({
      unlocked: false,
      activeTeamPlan: null,
      stripeSlug: planSlug,
    });
    return {
      userId: input.userId,
      isPro: true,
      maxPersonalDecks: lim.maxPersonalDecks,
      maxCardsPerDeck: lim.maxCardsPerDeck,
      hasUnlimitedDecks: lim.maxPersonalDecks > FREE_PERSONAL_DECK_LIMIT,
      has75CardsPerDeck: lim.maxCardsPerDeck > FREE_CARDS_PER_DECK_LIMIT,
      hasAI: true,
      hasAiReading: input.aiReadingForTier(planSlug),
      hasPrioritySupport: prioritySupportForAccess({
        isPlatformAdmin: false,
        activeTeamPlan: null,
        personalPlanSlug: planSlug,
        hasClerkProPlusPlan: input.paidProPlusFromHas,
      }),
      hasCustomColors: true,
      hasProPlusInterfacePalette: planSlug === "pro_plus" || input.paidCustomColors,
      adminGranted: false,
      isAdmin: false,
      isSuperadmin: false,
      activeTeamPlan: null,
      hasClerkPersonalPro: input.paidProFromHas,
      hasClerkPersonalProPlus: input.paidProPlusFromHas,
      primaryEmail: input.primaryEmail,
    };
  }

  return null;
}

/** Clerk Backend `User` — avoid importing heavy types; used only for inbox badge email reuse in layout. */
function primaryEmailFromClerkBackendUser(user: {
  primaryEmailAddressId?: string | null;
  emailAddresses?: { id: string; emailAddress: string }[] | null;
}): string | null {
  const list = user.emailAddresses ?? [];
  const pid = user.primaryEmailAddressId;
  const primary =
    pid != null && pid !== ""
      ? list.find((e) => e.id === pid)
      : undefined;
  return (primary ?? list[0])?.emailAddress ?? null;
}

/** Signed-out / degraded access — safe fallback when Clerk or billing resolution fails. */
export function guestAccessContext(): AccessContext {
  return {
    userId: null,
    isPro: false,
    maxPersonalDecks: FREE_PERSONAL_DECK_LIMIT,
    maxCardsPerDeck: FREE_CARDS_PER_DECK_LIMIT,
    hasUnlimitedDecks: false,
    has75CardsPerDeck: false,
    hasAI: false,
    hasAiReading: false,
    hasPrioritySupport: false,
    hasCustomColors: false,
    hasProPlusInterfacePalette: false,
    adminGranted: false,
    isAdmin: false,
    isSuperadmin: false,
    activeTeamPlan: null,
    hasClerkPersonalPro: false,
    hasClerkPersonalProPlus: false,
    primaryEmail: null,
  };
}

/**
 * Returns the full access context for the current user, combining Stripe-backed billing metadata,
 * Clerk JWT features, admin-granted access, and the admin role itself.
 *
 * Wrapped in React `cache()` so layout + nested Server Components share one Clerk/Billing round-trip
 * per request (avoids Backend API rate limits during dev prefetch/HMR).
 */
export const getAccessContext = cache(async function getAccessContext(): Promise<AccessContext> {
  const { userId, has } = await auth();

  if (!userId) {
    return guestAccessContext();
  }

  const superadminAllowListed = isPlatformSuperadminAllowListed(userId);

  const stripeSubPromise = getActiveStripeSubscription(userId).catch(() => null);

  let primaryEmail: string | null = null;
  let meta: PublicMeta;
  try {
    const user = await clerkClient.users.getUser(userId);
    meta = user.publicMetadata as PublicMeta;
    primaryEmail = primaryEmailFromClerkBackendUser(user);
  } catch (error) {
    // Session JWT still valid but user was deleted (self-service delete, admin purge, etc.).
    if (isClerkUserNotFoundError(error)) {
      redirect(CLEAR_STALE_SESSION_PATH);
    }
    if (!isClerkBackendDegradableError(error)) throw error;
    // Degrade to JWT-only resolution when Clerk Backend is unreachable or rate-limited.
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[getAccessContext] Clerk Backend unavailable; using JWT-only access.",
        error,
      );
    }
    meta = {} as PublicMeta;
  }
  const stripeSub = await stripeSubPromise;
  const planResolution = await resolvePersonalPlanMetadataVsBilling({
    clerkClient,
    userId,
    has,
    publicMetadata: meta,
    stripeDbPlanSlug: stripeSub?.planSlug ?? null,
  });

  const metadataForcedPersonalFree =
    planResolution.winner === "metadata" &&
    metadataPlanSlugFromPublicMeta(meta) == null;

  const paidProFromHas = Boolean(has({ plan: "pro" }));
  const paidProPlusFromHas = Boolean(has({ plan: "pro_plus" }));
  const paidAI = Boolean(has({ feature: "ai_flashcard_generation" }));
  const paidCustomColors = Boolean(has({ feature: "12_interface_colors" }));
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

  const jwtTeamPlan = resolveActiveTeamPlanFromHas(has);

  const teamPlanForFeatures =
    planResolution.winner === "metadata"
      ? planResolution.activeTeamPlan
      : planResolution.activeTeamPlan !== null
        ? planResolution.activeTeamPlan
        : jwtTeamPlan;

  const billingApiDrovePersonalPro =
    planResolution.comparedMetadataToBilling &&
    planResolution.winner === "billing" &&
    effectivePersonalPro &&
    !planResolution.billingJwtPersonalPro;

  const metadataDrovePersonalPro =
    planResolution.winner === "metadata" || planResolution.legacyMetadataOverride;

  const jwtPersonalProFullBundle =
    proFeatureBundle && planResolution.billingJwtPersonalPro;

  /** Flashcard speaker (TTS) — Pro Plus (personal), team-tier subscribers, platform admins only; not Free or Pro. */
  function aiReadingForTier(stripeSlug: string | undefined | null): boolean {
    if (unlocked) return true;
    if (teamPlanForFeatures !== null) return true;
    return personalPaidSlugFromStripeSlug(stripeSlug) === "pro_plus";
  }

  // Platform admins automatically receive every paid feature.
  if (unlocked) {
    const lim = personalWorkspaceLimits({
      unlocked: true,
      activeTeamPlan: teamPlanForFeatures,
      stripeSlug: stripeSlugForPersonalTier(planResolution),
    });
    return {
      userId,
      isPro: true,
      maxPersonalDecks: lim.maxPersonalDecks,
      maxCardsPerDeck: lim.maxCardsPerDeck,
      hasUnlimitedDecks: lim.maxPersonalDecks > FREE_PERSONAL_DECK_LIMIT,
      has75CardsPerDeck: lim.maxCardsPerDeck > FREE_CARDS_PER_DECK_LIMIT,
      hasAI: true,
      hasAiReading: true,
      hasPrioritySupport: true,
      hasCustomColors: true,
      hasProPlusInterfacePalette: true,
      adminGranted,
      isAdmin,
      isSuperadmin,
      activeTeamPlan: teamPlanForFeatures,
      hasClerkPersonalPro: paidProFromHas && !paidProPlusFromHas,
      /** Personal URLs / plan query use Pro Plus for platform-admin complimentary tier. */
      hasClerkPersonalProPlus: true,
      primaryEmail,
    };
  }

  // Team-tier subscriber personal workspace matches Pro Plus caps.
  // Team-tier subscribers: personal workspace uses Pro Plus caps; grant full premium
  // feature bundle without relying on Clerk JWT feature flags (session templates vary).
  if (teamPlanForFeatures !== null && !superadminAllowListed) {
    const lim = personalWorkspaceLimits({
      unlocked: false,
      activeTeamPlan: teamPlanForFeatures,
      stripeSlug: stripeSlugForPersonalTier(planResolution),
    });
    return {
      userId,
      isPro: true,
      maxPersonalDecks: lim.maxPersonalDecks,
      maxCardsPerDeck: lim.maxCardsPerDeck,
      hasUnlimitedDecks: lim.maxPersonalDecks > FREE_PERSONAL_DECK_LIMIT,
      has75CardsPerDeck: lim.maxCardsPerDeck > FREE_CARDS_PER_DECK_LIMIT,
      hasAI: true,
      hasAiReading: true,
      hasPrioritySupport: true,
      hasCustomColors: true,
      hasProPlusInterfacePalette: true,
      adminGranted: false,
      isAdmin: false,
      isSuperadmin: false,
      activeTeamPlan: teamPlanForFeatures,
      hasClerkPersonalPro: paidProFromHas,
      hasClerkPersonalProPlus: paidProPlusFromHas,
      primaryEmail,
    };
  }

  if (effectivePersonalPro && !superadminAllowListed) {
    const grantFullPersonalPro =
      jwtPersonalProFullBundle ||
      metadataDrovePersonalPro ||
      billingApiDrovePersonalPro;

    if (grantFullPersonalPro) {
      const stripeSlug = stripeSlugForPersonalTier(planResolution);
      const lim = personalWorkspaceLimits({
        unlocked: false,
        activeTeamPlan: null,
        stripeSlug,
      });
      return {
        userId,
        isPro: true,
        maxPersonalDecks: lim.maxPersonalDecks,
        maxCardsPerDeck: lim.maxCardsPerDeck,
        hasUnlimitedDecks: lim.maxPersonalDecks > FREE_PERSONAL_DECK_LIMIT,
        has75CardsPerDeck: lim.maxCardsPerDeck > FREE_CARDS_PER_DECK_LIMIT,
        hasAI: true,
        hasAiReading: aiReadingForTier(stripeSlug),
        hasPrioritySupport: prioritySupportForAccess({
          isPlatformAdmin: false,
          activeTeamPlan: null,
          personalPlanSlug: personalPaidSlugFromStripeSlug(stripeSlug),
          hasClerkProPlusPlan: paidProPlusFromHas,
        }),
        hasCustomColors: paidCustomColors || Boolean(stripeSlug),
        hasProPlusInterfacePalette:
          paidCustomColors || personalPaidSlugFromStripeSlug(stripeSlug) === "pro_plus",
        adminGranted: false,
        isAdmin: false,
        isSuperadmin: false,
        activeTeamPlan: null,
        hasClerkPersonalPro: paidProFromHas,
        hasClerkPersonalProPlus: paidProPlusFromHas,
        primaryEmail,
      };
    }
  }

  // Billing metadata fallback when computed `plan` metadata is stale but Stripe keys are fresh.
  if (!unlocked && !metadataForcedPersonalFree && !superadminAllowListed) {
    const rawBillingPlan =
      typeof meta.billingPlan === "string" ? meta.billingPlan.trim() || null : null;
    const rawBillingStatus =
      typeof meta.billingStatus === "string" ? meta.billingStatus : null;
    const isBillingActiveRaw =
      rawBillingStatus === "active" || rawBillingStatus === "trialing";

    if (isBillingActiveRaw && rawBillingPlan !== null) {
      if (isTeamPlanId(rawBillingPlan)) {
        const canonical = canonicalTeamPlanId(rawBillingPlan)!;
        const lim = personalWorkspaceLimits({
          unlocked: false,
          activeTeamPlan: canonical,
          stripeSlug: undefined,
        });
        return {
          userId,
          isPro: true,
          maxPersonalDecks: lim.maxPersonalDecks,
          maxCardsPerDeck: lim.maxCardsPerDeck,
          hasUnlimitedDecks: lim.maxPersonalDecks > FREE_PERSONAL_DECK_LIMIT,
          has75CardsPerDeck: lim.maxCardsPerDeck > FREE_CARDS_PER_DECK_LIMIT,
          hasAI: true,
          hasAiReading: true,
          hasPrioritySupport: true,
          hasCustomColors: true,
          hasProPlusInterfacePalette: true,
          adminGranted: false,
          isAdmin: false,
          isSuperadmin: false,
          activeTeamPlan: canonical,
          hasClerkPersonalPro: paidProFromHas,
          hasClerkPersonalProPlus: paidProPlusFromHas,
          primaryEmail,
        };
      }
      if (rawBillingPlan === "pro" || rawBillingPlan === "pro_plus") {
        const lim = personalWorkspaceLimits({
          unlocked: false,
          activeTeamPlan: null,
          stripeSlug: rawBillingPlan,
        });
        return {
          userId,
          isPro: true,
          maxPersonalDecks: lim.maxPersonalDecks,
          maxCardsPerDeck: lim.maxCardsPerDeck,
          hasUnlimitedDecks: lim.maxPersonalDecks > FREE_PERSONAL_DECK_LIMIT,
          has75CardsPerDeck: lim.maxCardsPerDeck > FREE_CARDS_PER_DECK_LIMIT,
          hasAI: true,
          hasAiReading: aiReadingForTier(rawBillingPlan),
          hasPrioritySupport: prioritySupportForAccess({
            isPlatformAdmin: false,
            activeTeamPlan: null,
            personalPlanSlug: personalPaidSlugFromStripeSlug(rawBillingPlan),
            hasClerkProPlusPlan: paidProPlusFromHas,
          }),
          hasCustomColors: true,
          hasProPlusInterfacePalette:
            rawBillingPlan === "pro_plus" || paidCustomColors,
          adminGranted: false,
          isAdmin: false,
          isSuperadmin: false,
          activeTeamPlan: null,
          hasClerkPersonalPro: paidProFromHas,
          hasClerkPersonalProPlus: paidProPlusFromHas,
          primaryEmail,
        };
      }
    }
  }

  if (!unlocked && !superadminAllowListed) {
    const affiliateAccess = await accessContextFromActiveAffiliateGrant({
      userId,
      primaryEmail,
      paidProFromHas,
      paidProPlusFromHas,
      paidCustomColors,
      aiReadingForTier,
    });
    if (affiliateAccess) return affiliateAccess;
  }

  const jwtPaid = !metadataForcedPersonalFree;

  let inferredStripeSlug = stripeSlugForPersonalTier(planResolution);
  if (inferredStripeSlug === undefined && jwtPaid) {
    if (paidProPlusFromHas) inferredStripeSlug = "pro_plus";
    else if (paidProFromHas) inferredStripeSlug = "pro";
  }

  const lim = personalWorkspaceLimits({
    unlocked: false,
    activeTeamPlan: null,
    stripeSlug: inferredStripeSlug,
  });

  const isProJwt =
    jwtPaid && (paidProFromHas || paidProPlusFromHas || proFeatureBundle);

  let jwtProPlusInterfacePalette = false;
  if (jwtPaid) {
    const personalSlug = personalPaidSlugFromStripeSlug(inferredStripeSlug);
    if (personalSlug === "pro" && !paidCustomColors) {
      jwtProPlusInterfacePalette = false;
    } else {
      jwtProPlusInterfacePalette =
        paidProPlusFromHas ||
        paidCustomColors ||
        Boolean(has({ feature: "pro_plus_plan_features" })) ||
        personalSlug === "pro_plus" ||
        (!paidProFromHas &&
          !paidProPlusFromHas &&
          legacyUnlimitedStyleProBundleSatisfied(has));
    }
  }

  return {
    userId,
    isPro: isProJwt || unlocked,
    maxPersonalDecks: lim.maxPersonalDecks,
    maxCardsPerDeck: lim.maxCardsPerDeck,
    hasUnlimitedDecks: lim.maxPersonalDecks > FREE_PERSONAL_DECK_LIMIT,
    has75CardsPerDeck: lim.maxCardsPerDeck > FREE_CARDS_PER_DECK_LIMIT,
    hasAI:
      jwtPaid &&
      (paidAI || paidProFromHas || paidProPlusFromHas || proFeatureBundle),
    hasAiReading: aiReadingForTier(inferredStripeSlug),
    hasPrioritySupport: prioritySupportForAccess({
      isPlatformAdmin: unlocked,
      activeTeamPlan: null,
      personalPlanSlug: personalPaidSlugFromStripeSlug(inferredStripeSlug),
      hasClerkProPlusPlan: paidProPlusFromHas,
    }),
    hasCustomColors:
      jwtPaid &&
      (paidCustomColors || paidProFromHas || paidProPlusFromHas || proFeatureBundle),
    hasProPlusInterfacePalette: jwtProPlusInterfacePalette,
    adminGranted,
    isAdmin,
    isSuperadmin,
    activeTeamPlan: null,
    hasClerkPersonalPro: jwtPaid && paidProFromHas,
    hasClerkPersonalProPlus: jwtPaid && paidProPlusFromHas,
    primaryEmail,
  };
});
