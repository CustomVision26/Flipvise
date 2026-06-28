import { cache } from "react";
import { createClerkClient } from "@clerk/backend";
import { getAccessContext } from "@/lib/access";
import { listAffiliatesForPlanHistory } from "@/db/queries/affiliates";
import { getActiveStripeSubscription } from "@/db/queries/stripe-subscriptions";
import {
  resolveActiveAffiliateGrant,
  resolveBillingTabPlanDisplay,
  type BillingTabPlanDisplay,
} from "@/lib/billing-tab-plan-display";
import type { AccessContext } from "@/lib/access";
import { isPlatformSuperadminAllowListed } from "@/lib/platform-superadmin";
import {
  resolvePersonalPlanMetadataVsBilling,
  type PlanPublicMetadata,
} from "@/lib/plan-metadata-billing-resolution";
import { TEAM_PLAN_LABELS, isTeamPlanId, type TeamPlanId } from "@/lib/team-plans";
import {
  formatPersonalDashboardPlanAccessPhrase,
  resolveAdminUserPlanAccessType,
  type AdminPlanAccessMeta,
  type AdminUserPlanAccessType,
} from "@/lib/admin-user-plan-label";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

/**
 * Display label for the personal workspace row in the header switcher (`Personal Dash · …`).
 * Platform admins / complimentary unlock use Pro Plus (not Pro) — matches `getAccessContext()`.
 */
export function personalWorkspacePlanDisplayLabel(input: {
  activeTeamPlan: TeamPlanId | null;
  isPro: boolean;
  /** From `getAccessContext()` — true for Pro Plus, team-tier personal caps, and platform admins. */
  hasProPlusInterfacePalette: boolean;
}): string {
  if (input.activeTeamPlan != null) {
    return TEAM_PLAN_LABELS[input.activeTeamPlan];
  }
  if (input.hasProPlusInterfacePalette) {
    return "Pro Plus";
  }
  if (input.isPro) {
    return "Pro";
  }
  return "Free";
}

/**
 * Fast path for `/admin/*` — avoids affiliate, Stripe, and Clerk metadata round-trips.
 * Platform admins always show SuperAdmin / Co-Admin + Pro Plus account label.
 */
export function personalWorkspaceLabelsFromAccessContext(
  ctx: Pick<
    AccessContext,
    | "isSuperadmin"
    | "isAdmin"
    | "activeTeamPlan"
    | "isPro"
    | "hasProPlusInterfacePalette"
  >,
): { personalPlanLabelForWorkspace: string; personalAccountPlanLabel: string } {
  if (ctx.isSuperadmin) {
    return {
      personalPlanLabelForWorkspace: "SuperAdmin",
      personalAccountPlanLabel: "Pro Plus",
    };
  }
  if (ctx.isAdmin) {
    return {
      personalPlanLabelForWorkspace: "Co-Admin",
      personalAccountPlanLabel: "Pro Plus",
    };
  }
  const tierLabel = personalWorkspacePlanDisplayLabel({
    activeTeamPlan: ctx.activeTeamPlan,
    isPro: ctx.isPro,
    hasProPlusInterfacePalette: ctx.hasProPlusInterfacePalette,
  });
  return {
    personalPlanLabelForWorkspace: tierLabel,
    personalAccountPlanLabel: tierLabel,
  };
}

/** Maps billing resolution to workspace access type labels shown in the header switcher. */
export function personalWorkspaceAccessLabelFromPlanDisplay(
  planDisplay: BillingTabPlanDisplay,
  fallbackInput: {
    activeTeamPlan: TeamPlanId | null;
    isPro: boolean;
    hasProPlusInterfacePalette: boolean;
  },
): string {
  if (planDisplay.accessSubtitle === "Affiliate grant") {
    return `${planDisplay.planLabel} (Affiliate)`;
  }
  if (planDisplay.showPaidStripeControls) {
    return "Subscriber";
  }
  if (planDisplay.isComplimentary) {
    return "Complimentary";
  }
  if (!planDisplay.isPaid) {
    return "Free";
  }
  return personalWorkspacePlanDisplayLabel(fallbackInput);
}

type PersonalWorkspaceLabelContext = {
  ctx: Pick<
    AccessContext,
    | "isSuperadmin"
    | "isAdmin"
    | "activeTeamPlan"
    | "isPro"
    | "hasProPlusInterfacePalette"
  >;
  planDisplay: BillingTabPlanDisplay;
  planAccessType: AdminUserPlanAccessType;
};

function primaryEmailFromClerkUser(user: {
  primaryEmailAddressId?: string | null;
  emailAddresses?: { id: string; emailAddress: string }[] | null;
}): string | null {
  const list = user.emailAddresses ?? [];
  const pid = user.primaryEmailAddressId;
  const primary =
    pid != null && pid !== "" ? list.find((e) => e.id === pid) : undefined;
  return (primary ?? list[0])?.emailAddress ?? null;
}

async function loadPlanLabelContextForUser(
  userId: string,
  ctx: PersonalWorkspaceLabelContext["ctx"],
  meta: Record<string, unknown>,
  primaryEmail: string | null,
): Promise<PersonalWorkspaceLabelContext> {
  const [affiliates, stripeSub] = await Promise.all([
    listAffiliatesForPlanHistory(userId, primaryEmail?.toLowerCase() ?? null),
    getActiveStripeSubscription(userId),
  ]);

  const activeAffiliateGrant = resolveActiveAffiliateGrant(affiliates);
  const billingStatus =
    typeof meta.billingStatus === "string" ? meta.billingStatus : null;

  const planDisplay = resolveBillingTabPlanDisplay({
    meta,
    stripePlanSlug: stripeSub?.planSlug?.trim() ?? null,
    billingStatus,
    activeAffiliateGrant,
    platformAdminUnlocked: ctx.isAdmin,
  });

  const planAccessType = resolveAdminUserPlanAccessType({
    meta: meta as AdminPlanAccessMeta,
    isSuperadmin: ctx.isSuperadmin,
    isCoAdmin: ctx.isAdmin && !ctx.isSuperadmin,
    isActiveAffiliate: activeAffiliateGrant != null,
  });

  return { ctx, planDisplay, planAccessType };
}

function accessContextPickForPlanLabels(input: {
  isSuperadmin: boolean;
  isAdmin: boolean;
  activeTeamPlan: TeamPlanId | null;
  effectivePersonalPro: boolean;
  stripeSlug: string | null | undefined;
}): PersonalWorkspaceLabelContext["ctx"] {
  const personalSlug =
    input.stripeSlug === "pro" || input.stripeSlug === "pro_plus"
      ? input.stripeSlug
      : null;
  return {
    isSuperadmin: input.isSuperadmin,
    isAdmin: input.isAdmin,
    activeTeamPlan: input.activeTeamPlan,
    isPro:
      input.isAdmin ||
      input.effectivePersonalPro ||
      input.activeTeamPlan !== null ||
      personalSlug !== null,
    hasProPlusInterfacePalette:
      input.isAdmin ||
      input.activeTeamPlan !== null ||
      personalSlug === "pro_plus",
  };
}

/**
 * Session-independent plan labels for `/api/sync` (device sync token has no Clerk session).
 * Matches online header switcher + account menu for the resolved `userId`.
 */
export async function resolvePersonalWorkspaceLabelsForUserId(userId: string): Promise<{
  personalPlanLabel: string;
  personalAccountPlanLabel: string;
  personalPlanAccessType: AdminUserPlanAccessType;
  personalHasTeamTierPlan: boolean;
  viewerIsSuperadmin: boolean;
  viewerIsPlatformAdmin: boolean;
}> {
  const loaded = await loadPersonalWorkspaceLabelContextForUserId(userId);
  if (!loaded) {
    return {
      personalPlanLabel: "Free",
      personalAccountPlanLabel: "Free",
      personalPlanAccessType: "Free",
      personalHasTeamTierPlan: false,
      viewerIsSuperadmin: false,
      viewerIsPlatformAdmin: false,
    };
  }
  return {
    personalPlanLabel: personalWorkspaceAccessLabel(loaded),
    personalAccountPlanLabel: personalWorkspaceAccountPlanLabel(loaded),
    personalPlanAccessType: loaded.planAccessType,
    personalHasTeamTierPlan:
      loaded.ctx.activeTeamPlan != null && isTeamPlanId(loaded.ctx.activeTeamPlan),
    viewerIsSuperadmin: loaded.ctx.isSuperadmin,
    viewerIsPlatformAdmin: loaded.ctx.isAdmin,
  };
}

async function loadPersonalWorkspaceLabelContextForUserId(
  userId: string,
): Promise<PersonalWorkspaceLabelContext | null> {
  const superadminAllowListed = isPlatformSuperadminAllowListed(userId);

  let meta: Record<string, unknown> = {};
  let primaryEmail: string | null = null;
  try {
    const user = await clerkClient.users.getUser(userId);
    meta = (user.publicMetadata ?? {}) as Record<string, unknown>;
    primaryEmail = primaryEmailFromClerkUser(user);
  } catch {
    if (!superadminAllowListed) return null;
  }

  const planResolution = await resolvePersonalPlanMetadataVsBilling({
    clerkClient,
    userId,
    has: () => false,
    publicMetadata: meta as PlanPublicMetadata,
  });

  const liveRole = typeof meta.role === "string" ? meta.role : undefined;
  const isSuperadminUser = liveRole === "superadmin";
  const isSuperadmin = superadminAllowListed || isSuperadminUser;
  const isAdmin = liveRole === "admin" || isSuperadmin;
  const activeTeamPlan = planResolution.activeTeamPlan;
  const effectivePersonalPro =
    planResolution.personalPro && activeTeamPlan === null;
  const stripeSlug =
    activeTeamPlan !== null ? null : planResolution.effectiveStripeSlug;

  const ctx = accessContextPickForPlanLabels({
    isSuperadmin,
    isAdmin,
    activeTeamPlan,
    effectivePersonalPro,
    stripeSlug,
  });

  return loadPlanLabelContextForUser(userId, ctx, meta, primaryEmail);
}

const loadPersonalWorkspaceLabelContext = cache(
  async function loadPersonalWorkspaceLabelContext(): Promise<PersonalWorkspaceLabelContext | null> {
    const fullCtx = await getAccessContext();
    if (!fullCtx.userId) return null;

    const meta = await clerkClient.users
      .getUser(fullCtx.userId)
      .then((u) => u.publicMetadata as Record<string, unknown>)
      .catch(() => ({} as Record<string, unknown>));

    const ctx: PersonalWorkspaceLabelContext["ctx"] = {
      isSuperadmin: fullCtx.isSuperadmin,
      isAdmin: fullCtx.isAdmin,
      activeTeamPlan: fullCtx.activeTeamPlan,
      isPro: fullCtx.isPro,
      hasProPlusInterfacePalette: fullCtx.hasProPlusInterfacePalette,
    };

    return loadPlanLabelContextForUser(
      fullCtx.userId,
      ctx,
      meta,
      fullCtx.primaryEmail,
    );
  },
);

function personalWorkspaceAccountPlanLabel(
  loaded: PersonalWorkspaceLabelContext,
): string {
  const { ctx, planDisplay } = loaded;
  if (ctx.isAdmin) {
    return "Pro Plus";
  }
  if (ctx.activeTeamPlan != null) {
    return TEAM_PLAN_LABELS[ctx.activeTeamPlan];
  }
  if (planDisplay.planLabel) {
    return planDisplay.planLabel;
  }
  return personalWorkspacePlanDisplayLabel({
    activeTeamPlan: ctx.activeTeamPlan,
    isPro: ctx.isPro,
    hasProPlusInterfacePalette: ctx.hasProPlusInterfacePalette,
  });
}

function personalWorkspaceAccessLabel(
  loaded: PersonalWorkspaceLabelContext,
): string {
  const { ctx, planDisplay } = loaded;
  if (ctx.isSuperadmin) return "SuperAdmin";
  if (ctx.isAdmin) return "Co-Admin";
  return personalWorkspaceAccessLabelFromPlanDisplay(planDisplay, {
    activeTeamPlan: ctx.activeTeamPlan,
    isPro: ctx.isPro,
    hasProPlusInterfacePalette: ctx.hasProPlusInterfacePalette,
  });
}

/** Billing tier name for the header plan link (Pro Plus, Team Basic, Free, …). */
export const getPersonalWorkspaceAccountPlanLabel = cache(
  async function getPersonalWorkspaceAccountPlanLabel(): Promise<string> {
    const loaded = await loadPersonalWorkspaceLabelContext();
    if (!loaded) return "Free";
    return personalWorkspaceAccountPlanLabel(loaded);
  },
);

/**
 * Server-resolved access label for `Personal Dash · …` in the workspace switcher.
 * Priority: SuperAdmin / Co-Admin (platform role) → plan name (Affiliate) → Subscriber → Complimentary → tier / Free.
 */
export const getPersonalWorkspaceAccessLabel = cache(
  async function getPersonalWorkspaceAccessLabel(): Promise<string> {
    const loaded = await loadPersonalWorkspaceLabelContext();
    if (!loaded) return "Free";
    return personalWorkspaceAccessLabel(loaded);
  },
);

/** How the personal plan is sourced — Paid, Affiliate, Complimentary, Assigned, Free. */
export const getPersonalPlanAccessType = cache(
  async function getPersonalPlanAccessType(): Promise<AdminUserPlanAccessType> {
    const loaded = await loadPersonalWorkspaceLabelContext();
    if (!loaded) return "Free";
    return loaded.planAccessType;
  },
);

/** Cached plan source for the personal dashboard footer (`paid plan`, `assigned plan`, …). */
export const getPersonalDashboardPlanAccessPhrase = cache(
  async function getPersonalDashboardPlanAccessPhrase(): Promise<{
    article: "a" | "an";
    label: string;
  }> {
    const loaded = await loadPersonalWorkspaceLabelContext();
    if (!loaded) {
      return formatPersonalDashboardPlanAccessPhrase("Free");
    }
    return formatPersonalDashboardPlanAccessPhrase(loaded.planAccessType);
  },
);
