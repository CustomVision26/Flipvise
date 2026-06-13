import { isStripePaidPlanId } from "@/lib/billing-plan-ids";
import {
  resolveEffectivePlan,
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

  const meta = input.meta;
  const billingStatus =
    typeof meta.billingStatus === "string" ? meta.billingStatus : null;
  const billingPlanSlug = normalizePlanSlug(
    typeof meta.billingPlan === "string" ? meta.billingPlan : null,
  );
  const adminPlanSlug = normalizePlanSlug(
    typeof meta.adminPlan === "string" ? meta.adminPlan : null,
  );
  const effectivePlanSlug = normalizePlanSlug(
    resolveEffectivePlan(meta as Record<string, unknown>),
  );
  const isBillingActive =
    billingStatus === "active" || billingStatus === "trialing";
  const accessFromAdminGrant =
    !!adminPlanSlug &&
    !!effectivePlanSlug &&
    planSlugsMatch(adminPlanSlug, effectivePlanSlug);
  const stripeAuthoritative =
    isBillingActive &&
    !!billingPlanSlug &&
    !!effectivePlanSlug &&
    planSlugsMatch(billingPlanSlug, effectivePlanSlug) &&
    !accessFromAdminGrant &&
    isPaidStripePlanSlug(billingPlanSlug);

  if (stripeAuthoritative) {
    return "Paid";
  }
  if (meta.adminGranted === true || accessFromAdminGrant) {
    return "Assigned";
  }
  if (effectivePlanSlug != null && effectivePlanSlug !== "free") {
    return "Assigned";
  }

  return "Free";
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
