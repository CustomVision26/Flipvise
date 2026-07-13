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
import {
  educationAccessFieldsFromSources,
  educationAccessFieldsFromPlanSlug,
  type EducationAccessFields,
} from "@/lib/education-access";
import {
  canonicalEducationPlanId,
  isEducationPlanId,
  isEducationTeamPlanId,
  type EducationTeamPlanId,
} from "@/lib/education-plans";
import { listAffiliatesForPlanHistory } from "@/db/queries/affiliates";
import { enforceExpiredPaymentGraceIfNeeded } from "@/lib/billing-grace-enforcement";
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
  /** Resolved effective plan slug from billing/admin metadata. */
  effectivePlanSlug: string | null;
  /** Teacher dashboard and education tools (education_plus, education_gold, education_enterprise). */
  canAccessTeacherTools: boolean;
  /** education_gold or education_enterprise — parallel to activeTeamPlan for education team tiers. */
  activeEducationTeamPlan: EducationTeamPlanId | null;
};

function withEducationFields(
  ctx: Omit<
    AccessContext,
    | "effectivePlanSlug"
    | "canAccessTeacherTools"
    | "activeEducationTeamPlan"
  >,
  education: EducationAccessFields,
): AccessContext {
  return { ...ctx, ...education };
}

function educationTeamTierAccessContext(input: {
  userId: string;
  activeEducationTeamPlan: EducationTeamPlanId;
  education: EducationAccessFields;
  paidProFromHas: boolean;
  paidProPlusFromHas: boolean;
  primaryEmail: string | null;
}): AccessContext {
  const lim = personalWorkspaceLimits({
    unlocked: false,
    activeTeamPlan: null,
    activeEducationTeamPlan: input.activeEducationTeamPlan,
    stripeSlug: undefined,
  });
  return withEducationFields(
    {
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
      activeTeamPlan: null,
      hasClerkPersonalPro: input.paidProFromHas,
      hasClerkPersonalProPlus: input.paidProPlusFromHas,
      primaryEmail: input.primaryEmail,
    },
    input.education,
  );
}

function personalPaidSlugFromStripeSlug(
  slug: string | undefined | null,
): "pro" | "pro_plus" | null {
  if (slug === "pro" || slug === "pro_plus") return slug;
  return null;
}

function prioritySupportForAccess(input: {
  isPlatformAdmin: boolean;
  activeTeamPlan: TeamPlanId | null;
  personalPlanSlug: string | null | undefined;
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
  activeEducationTeamPlan?: EducationTeamPlanId | null;
  stripeSlug: string | undefined | null;
}): { maxPersonalDecks: number; maxCardsPerDeck: number } {
  if (
    input.unlocked ||
    input.activeTeamPlan !== null ||
    input.activeEducationTeamPlan != null
  ) {
    return proPlusPersonalLimits();
  }
  const personal = personalPaidSlugFromStripeSlug(input.stripeSlug);
  if (personal === "pro_plus") return limitsForPersonalIndividualTier("pro_plus");
  if (input.stripeSlug === "education_plus") return limitsForPersonalIndividualTier("pro_plus");
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
    return withEducationFields(
      {
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
      },
      educationAccessFieldsFromPlanSlug(planSlug),
    );
  }

  if (planSlug === "pro" || planSlug === "pro_plus") {
    const lim = personalWorkspaceLimits({
      unlocked: false,
      activeTeamPlan: null,
      stripeSlug: planSlug,
    });
    return withEducationFields(
      {
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
          hasClerkProPlusPlan:
            planSlug === "pro_plus" || input.paidProPlusFromHas,
        }),
        hasCustomColors: true,
        hasProPlusInterfacePalette:
          planSlug === "pro_plus" || input.paidCustomColors,
        adminGranted: false,
        isAdmin: false,
        isSuperadmin: false,
        activeTeamPlan: null,
        hasClerkPersonalPro: input.paidProFromHas || planSlug === "pro",
        hasClerkPersonalProPlus:
          planSlug === "pro_plus" || input.paidProPlusFromHas,
        primaryEmail: input.primaryEmail,
      },
      educationAccessFieldsFromPlanSlug(planSlug),
    );
  }

  if (isEducationTeamPlanId(planSlug)) {
    const eduFields = educationAccessFieldsFromPlanSlug(planSlug);
    return educationTeamTierAccessContext({
      userId: input.userId,
      activeEducationTeamPlan: planSlug,
      education: eduFields,
      paidProFromHas: input.paidProFromHas,
      paidProPlusFromHas: input.paidProPlusFromHas,
      primaryEmail: input.primaryEmail,
    });
  }

  if (planSlug === "education_plus" || isEducationPlanId(planSlug)) {
    const lim = personalWorkspaceLimits({
      unlocked: false,
      activeTeamPlan: null,
      stripeSlug: "education_plus",
    });
    return withEducationFields(
      {
        userId: input.userId,
        isPro: true,
        maxPersonalDecks: lim.maxPersonalDecks,
        maxCardsPerDeck: lim.maxCardsPerDeck,
        hasUnlimitedDecks: lim.maxPersonalDecks > FREE_PERSONAL_DECK_LIMIT,
        has75CardsPerDeck: lim.maxCardsPerDeck > FREE_CARDS_PER_DECK_LIMIT,
        hasAI: true,
        hasAiReading: true,
        hasPrioritySupport: prioritySupportForAccess({
          isPlatformAdmin: false,
          activeTeamPlan: null,
          personalPlanSlug: "education_plus",
          hasClerkProPlusPlan: true,
        }),
        hasCustomColors: true,
        hasProPlusInterfacePalette: true,
        adminGranted: false,
        isAdmin: false,
        isSuperadmin: false,
        activeTeamPlan: null,
        hasClerkPersonalPro: input.paidProFromHas,
        hasClerkPersonalProPlus: true,
        primaryEmail: input.primaryEmail,
      },
      educationAccessFieldsFromPlanSlug(planSlug),
    );
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
    effectivePlanSlug: null,
    canAccessTeacherTools: false,
    activeEducationTeamPlan: null,
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

  await enforceExpiredPaymentGraceIfNeeded(userId).catch(() => {
    // Best-effort — access still resolves from Clerk metadata.
  });

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

  const educationFields = educationAccessFieldsFromSources({
    meta: meta as Record<string, unknown>,
    planResolution,
    stripeDbPlanSlug: stripeSub?.planSlug ?? null,
    has,
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
    if (educationFields.activeEducationTeamPlan !== null) return true;
    if (stripeSlug === "education_plus") return true;
    return personalPaidSlugFromStripeSlug(stripeSlug) === "pro_plus";
  }

  // Platform admins automatically receive every paid feature.
  if (unlocked) {
    const lim = personalWorkspaceLimits({
      unlocked: true,
      activeTeamPlan: teamPlanForFeatures,
      activeEducationTeamPlan: educationFields.activeEducationTeamPlan,
      stripeSlug: stripeSlugForPersonalTier(planResolution),
    });
    return withEducationFields(
      {
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
      },
      educationFields,
    );
  }

  if (
    educationFields.activeEducationTeamPlan !== null &&
    !superadminAllowListed
  ) {
    return educationTeamTierAccessContext({
      userId,
      activeEducationTeamPlan: educationFields.activeEducationTeamPlan,
      education: educationFields,
      paidProFromHas,
      paidProPlusFromHas,
      primaryEmail,
    });
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
    return withEducationFields(
      {
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
      },
      educationFields,
    );
  }

  if (effectivePersonalPro && !superadminAllowListed) {
    const grantFullPersonalPro =
      jwtPersonalProFullBundle ||
      metadataDrovePersonalPro ||
      billingApiDrovePersonalPro;

    if (grantFullPersonalPro) {
      const stripeSlug =
        stripeSlugForPersonalTier(planResolution) ??
        (educationFields.effectivePlanSlug === "education_plus"
          ? "education_plus"
          : undefined);
      const lim = personalWorkspaceLimits({
        unlocked: false,
        activeTeamPlan: null,
        stripeSlug,
      });
      const isEducationPlus = stripeSlug === "education_plus";
      return withEducationFields(
        {
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
            personalPlanSlug: isEducationPlus
              ? "education_plus"
              : personalPaidSlugFromStripeSlug(stripeSlug),
            hasClerkProPlusPlan: paidProPlusFromHas || isEducationPlus,
          }),
          hasCustomColors: paidCustomColors || Boolean(stripeSlug),
          hasProPlusInterfacePalette:
            paidCustomColors ||
            personalPaidSlugFromStripeSlug(stripeSlug) === "pro_plus" ||
            isEducationPlus,
          adminGranted: false,
          isAdmin: false,
          isSuperadmin: false,
          activeTeamPlan: null,
          hasClerkPersonalPro: paidProFromHas,
          hasClerkPersonalProPlus: paidProPlusFromHas || isEducationPlus,
          primaryEmail,
        },
        educationFields,
      );
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
      if (isEducationTeamPlanId(rawBillingPlan)) {
        const eduFields = educationAccessFieldsFromPlanSlug(rawBillingPlan);
        return educationTeamTierAccessContext({
          userId,
          activeEducationTeamPlan: rawBillingPlan,
          education: eduFields,
          paidProFromHas,
          paidProPlusFromHas,
          primaryEmail,
        });
      }
      if (isTeamPlanId(rawBillingPlan)) {
        const canonical = canonicalTeamPlanId(rawBillingPlan)!;
        const lim = personalWorkspaceLimits({
          unlocked: false,
          activeTeamPlan: canonical,
          stripeSlug: undefined,
        });
        return withEducationFields(
          {
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
          },
          educationFields,
        );
      }
      if (
        rawBillingPlan === "pro" ||
        rawBillingPlan === "pro_plus" ||
        rawBillingPlan === "education_plus"
      ) {
        const isEducationPlus = rawBillingPlan === "education_plus";
        const lim = personalWorkspaceLimits({
          unlocked: false,
          activeTeamPlan: null,
          stripeSlug: rawBillingPlan,
        });
        return withEducationFields(
          {
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
              personalPlanSlug: isEducationPlus
                ? "education_plus"
                : personalPaidSlugFromStripeSlug(rawBillingPlan),
              hasClerkProPlusPlan: paidProPlusFromHas || isEducationPlus,
            }),
            hasCustomColors: true,
            hasProPlusInterfacePalette:
              rawBillingPlan === "pro_plus" ||
              paidCustomColors ||
              isEducationPlus,
            adminGranted: false,
            isAdmin: false,
            isSuperadmin: false,
            activeTeamPlan: null,
            hasClerkPersonalPro: paidProFromHas,
            hasClerkPersonalProPlus: paidProPlusFromHas || isEducationPlus,
            primaryEmail,
          },
          educationFields,
        );
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
    if (affiliateAccess) {
      // Affiliate context already carries effectivePlanSlug from the grant.
      // Do not overwrite with meta/stripe education fields (often Free).
      return affiliateAccess;
    }
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

  return withEducationFields(
    {
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
        personalPlanSlug:
          educationFields.effectivePlanSlug === "education_plus"
            ? "education_plus"
            : personalPaidSlugFromStripeSlug(inferredStripeSlug),
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
    },
    educationFields,
  );
});
