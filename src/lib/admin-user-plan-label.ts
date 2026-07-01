import { isStripePaidPlanId } from "@/lib/billing-plan-ids";
import {
  resolveEffectivePlan,
  parsePlanSourceUpdatedAtMs,
  metadataPlanSlugFromPublicMeta,
  type PlanPublicMetadata,
} from "@/lib/plan-metadata-billing-resolution";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import { canonicalTeamPlanId, isTeamPlanId } from "@/lib/team-plans";

export type AdminUserPlanAccessType =
  | "Paid"
  | "Assigned"
  | "Affiliate"
  | "Complimentary"
  | "Free";

/** User-facing plan source phrase for the personal dashboard footer. */
export function formatPersonalDashboardPlanAccessPhrase(
  type: AdminUserPlanAccessType,
): { article: "a" | "an"; label: string } {
  switch (type) {
    case "Paid":
      return { article: "a", label: "paid plan" };
    case "Assigned":
      return { article: "an", label: "assigned plan" };
    case "Affiliate":
      return { article: "an", label: "affiliate plan" };
    case "Complimentary":
      return { article: "a", label: "complimentary plan" };
    case "Free":
      return { article: "a", label: "free plan" };
  }
}

type AdminPlanAccessMeta = PlanPublicMetadata & {
  role?: string;
  adminGranted?: boolean;
};

export type { AdminPlanAccessMeta };

function normalizePlanSlug(slug: string | null | undefined): string | null {
  if (!slug?.trim()) return null;
  return canonicalTeamPlanId(slug.trim()) ?? slug.trim();
}

function planSlugsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = normalizePlanSlug(a);
  const right = normalizePlanSlug(b);
  return left != null && right != null && left === right;
}

function isPaidStripePlanSlug(slug: string | null): boolean {
  if (!slug) return false;
  return (
    slug === "pro" ||
    slug === "pro_plus" ||
    isTeamPlanId(slug) ||
    isStripePaidPlanId(slug)
  );
}

/** Shared Stripe vs admin metadata resolution for admin tables and account billing UI. */
export type AdminUserPlanBillingContext = {
  metadataSlug: string | null;
  resolvedSlug: string | null;
  /** Plan slug for display (`resolveEffectivePlan` ?? metadata slug). */
  effectivePlanSlug: string | null;
  billingPlanSlug: string | null;
  adminPlanSlug: string | null;
  billingStatus: string | null;
  isBillingActive: boolean;
  accessFromAdminGrant: boolean;
  adminAssignmentAuthoritative: boolean;
  legacyAdminAssignment: boolean;
  stripeAuthoritative: boolean;
};

export function resolveAdminUserPlanBillingContext(
  meta: AdminPlanAccessMeta,
): AdminUserPlanBillingContext {
  const billingStatus =
    typeof meta.billingStatus === "string" ? meta.billingStatus : null;
  const billingPlanSlug = normalizePlanSlug(
    typeof meta.billingPlan === "string" ? meta.billingPlan : null,
  );
  const adminPlanSlug = normalizePlanSlug(
    typeof meta.adminPlan === "string" ? meta.adminPlan : null,
  );
  const metadataSlug = normalizePlanSlug(metadataPlanSlugFromPublicMeta(meta));
  const resolvedSlug = normalizePlanSlug(
    resolveEffectivePlan(meta as Record<string, unknown>),
  );
  const effectivePlanSlug = resolvedSlug ?? metadataSlug;
  const adminAssignedMs = parsePlanSourceUpdatedAtMs(meta.adminPlanUpdatedAt) ?? 0;
  const legacyAdminAssignedMs =
    parsePlanSourceUpdatedAtMs(meta.planSourceUpdatedAt) ?? 0;
  const billingMs = parsePlanSourceUpdatedAtMs(meta.billingPlanUpdatedAt) ?? 0;
  const isBillingActive =
    billingStatus === "active" || billingStatus === "trialing";
  const accessFromAdminGrant =
    !!adminPlanSlug &&
    !!effectivePlanSlug &&
    planSlugsMatch(adminPlanSlug, effectivePlanSlug);
  const adminAssignmentAuthoritative =
    !!adminPlanSlug &&
    (accessFromAdminGrant || adminAssignedMs > billingMs);
  const stripeAuthoritative =
    isBillingActive &&
    !!billingPlanSlug &&
    isPaidStripePlanSlug(billingPlanSlug) &&
    !adminAssignmentAuthoritative;
  const legacyAdminAssignment =
    legacyAdminAssignedMs > 0 &&
    !!metadataSlug &&
    isPaidStripePlanSlug(metadataSlug) &&
    !stripeAuthoritative;

  return {
    metadataSlug,
    resolvedSlug,
    effectivePlanSlug,
    billingPlanSlug,
    adminPlanSlug,
    billingStatus,
    isBillingActive,
    accessFromAdminGrant,
    adminAssignmentAuthoritative,
    legacyAdminAssignment,
    stripeAuthoritative,
  };
}

/** How the user’s personal plan is sourced — for the admin All Users table. */
export function resolveAdminUserPlanAccessType(input: {
  meta: AdminPlanAccessMeta;
  isSuperadmin: boolean;
  isCoAdmin: boolean;
  isActiveAffiliate: boolean;
}): AdminUserPlanAccessType {
  if (input.isSuperadmin || input.isCoAdmin) {
    return "Complimentary";
  }
  if (input.isActiveAffiliate) {
    return "Affiliate";
  }

  const {
    effectivePlanSlug,
    stripeAuthoritative,
    adminAssignmentAuthoritative,
    legacyAdminAssignment,
  } = resolveAdminUserPlanBillingContext(input.meta);
  const meta = input.meta;

  if (stripeAuthoritative) {
    return "Paid";
  }
  if (
    meta.adminGranted === true ||
    adminAssignmentAuthoritative ||
    legacyAdminAssignment
  ) {
    return "Assigned";
  }
  if (effectivePlanSlug != null && effectivePlanSlug !== "free") {
    return "Assigned";
  }

  return "Free";
}

/** Count users whose All Users table Plan type is Paid (active Stripe, not affiliate/admin grant). */
export function countClerkUsersWithPaidPlanAccess(
  clerkUsers: {
    id: string;
    publicMetadata: unknown;
  }[],
  activeAffiliateUserIds: Set<string>,
  isSuperadminUser: (userId: string) => boolean,
): number {
  let count = 0;
  for (const user of clerkUsers) {
    const meta = (user.publicMetadata ?? {}) as AdminPlanAccessMeta & {
      role?: string;
    };
    const isSuperadmin = meta.role === "superadmin" || isSuperadminUser(user.id);
    const isCoAdmin = meta.role === "admin";
    const planAccessType = resolveAdminUserPlanAccessType({
      meta,
      isSuperadmin,
      isCoAdmin,
      isActiveAffiliate: activeAffiliateUserIds.has(user.id),
    });
    if (planAccessType === "Paid") count++;
  }
  return count;
}

/**
 * Resolves a single line for the admin users table "Plan" column, in order:
 * admin role (super/co-admin) → subscribed product (`publicMetadata.plan` or
 * `teamPlanId`) → `adminGranted` → active Stripe with no plan slug → Free.
 *
 * Superadmin/co-admin are roles; both include Pro Plus–level gated features automatically (e.g. listen-to-card).
 */
export function getAdminUserPlanColumnLabel(input: {
  isSuperadmin: boolean;
  isCoAdmin: boolean;
  adminGranted: boolean;
  /** Clerk `publicMetadata.plan` or, for team billing, `publicMetadata.teamPlanId`. */
  planMeta: string | undefined;
  stripeSubscriptionActive: boolean;
}): string {
  const { isSuperadmin, isCoAdmin, adminGranted, planMeta, stripeSubscriptionActive } =
    input;
  if (isSuperadmin || isCoAdmin) {
    return "Pro Plus";
  }

  const p = planMeta?.trim();
  if (p) {
    return displayNameForBillingPlanSlug(p);
  }

  if (adminGranted) {
    return "Pro Plus";
  }

  if (stripeSubscriptionActive) {
    return "Pro (active subscription)";
  }

  return "Free";
}
