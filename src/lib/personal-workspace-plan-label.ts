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
import { TEAM_PLAN_LABELS, type TeamPlanId } from "@/lib/team-plans";
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
  ctx: Awaited<ReturnType<typeof getAccessContext>>;
  planDisplay: BillingTabPlanDisplay;
  planAccessType: AdminUserPlanAccessType;
};

const loadPersonalWorkspaceLabelContext = cache(
  async function loadPersonalWorkspaceLabelContext(): Promise<PersonalWorkspaceLabelContext | null> {
    const ctx = await getAccessContext();
    if (!ctx.userId) return null;

    const [affiliates, stripeSub, meta] = await Promise.all([
      listAffiliatesForPlanHistory(
        ctx.userId,
        ctx.primaryEmail?.toLowerCase() ?? null,
      ),
      getActiveStripeSubscription(ctx.userId),
      clerkClient.users
        .getUser(ctx.userId)
        .then((u) => u.publicMetadata as Record<string, unknown>)
        .catch(() => ({} as Record<string, unknown>)),
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
