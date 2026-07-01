import {
  isClerkPlatformAdminRole,
  isClerkSuperadminRole,
} from "@/lib/clerk-platform-admin-role";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import {
  resolveAdminUserPlanBillingContext,
  type AdminPlanAccessMeta,
} from "@/lib/admin-user-plan-label";
import { canonicalTeamPlanId } from "@/lib/team-plans";

export type BillingTabPlanDisplay = {
  planSlug: string | null;
  planLabel: string;
  isPaid: boolean;
  billingStatus: string | null;
  adminRoleLabel: string | null;
  isComplimentary: boolean;
  accessSubtitle: string;
  showPaidStripeControls: boolean;
};

export type ActiveAffiliateGrant = {
  planSlug: string;
};

type AffiliateGrantRow = {
  status: string;
  planAssigned: string;
  endsAt: Date | string;
  revokedAt?: Date | string | null;
};

function normalizePlanSlug(slug: string | null | undefined): string | null {
  if (!slug?.trim()) return null;
  return canonicalTeamPlanId(slug.trim()) ?? slug.trim();
}

/** Active marketing-affiliate row linked to this user (not revoked, not past end date). */
export function resolveActiveAffiliateGrant(
  rows: AffiliateGrantRow[],
): ActiveAffiliateGrant | null {
  const now = Date.now();
  for (const row of rows) {
    if (row.status !== "active") continue;
    if (row.revokedAt) continue;
    const ends = row.endsAt instanceof Date ? row.endsAt : new Date(row.endsAt);
    if (Number.isNaN(ends.getTime()) || ends.getTime() <= now) continue;
    const planSlug = normalizePlanSlug(row.planAssigned);
    if (!planSlug) continue;
    return { planSlug };
  }
  return null;
}

/** @deprecated Use {@link resolveActiveAffiliateGrant} */
export function hasActiveAffiliateGrant(
  rows: Omit<AffiliateGrantRow, "planAssigned">[],
): boolean {
  return rows.some((row) => {
    if (row.status !== "active") return false;
    if (row.revokedAt) return false;
    const ends = row.endsAt instanceof Date ? row.endsAt : new Date(row.endsAt);
    return !Number.isNaN(ends.getTime()) && ends.getTime() > Date.now();
  });
}

/** Mirrors header / `getAccessContext()` complimentary unlock for Account → Billing. */
export function resolveBillingTabPlanDisplay(input: {
  meta: Record<string, unknown>;
  stripePlanSlug: string | null;
  billingStatus: string | null;
  activeAffiliateGrant?: ActiveAffiliateGrant | null;
  /** True when `getAccessContext().isAdmin` — includes env superadmin allow-list. */
  platformAdminUnlocked?: boolean;
}): BillingTabPlanDisplay {
  const role = typeof input.meta.role === "string" ? input.meta.role : null;
  const adminGranted = input.meta.adminGranted === true;

  const isSuperadmin = isClerkSuperadminRole(role);
  const isPlatformAdmin =
    input.platformAdminUnlocked === true || isClerkPlatformAdminRole(role);
  const adminRoleLabel = isSuperadmin
    ? "Superadmin"
    : isPlatformAdmin
      ? "Platform Admin"
      : null;

  const stripeSlug = normalizePlanSlug(input.stripePlanSlug);
  const planCtx = resolveAdminUserPlanBillingContext(
    input.meta as AdminPlanAccessMeta,
  );
  const effectiveSlug = planCtx.effectivePlanSlug;
  const accessFromAdminGrant =
    planCtx.accessFromAdminGrant ||
    planCtx.adminAssignmentAuthoritative ||
    planCtx.legacyAdminAssignment;
  const activeAffiliateGrant = input.activeAffiliateGrant ?? null;

  let planSlug = effectiveSlug ?? stripeSlug;
  if (!planSlug && adminGranted) {
    planSlug = "pro_plus";
  }

  const accessFromAffiliateGrant = activeAffiliateGrant != null;

  if (accessFromAffiliateGrant) {
    planSlug = activeAffiliateGrant.planSlug;
  }

  /** Platform admins always use complimentary Pro Plus on personal workspace (matches `getAccessContext()`). */
  if (isPlatformAdmin) {
    planSlug = "pro_plus";
  }

  const isPaid = planSlug != null && planSlug !== "free";
  const planLabel = isPaid
    ? displayNameForBillingPlanSlug(planSlug)
    : "Free";

  const isComplimentary =
    isPaid &&
    (isPlatformAdmin ||
      adminGranted ||
      accessFromAdminGrant ||
      accessFromAffiliateGrant);

  const billingStatus =
    accessFromAffiliateGrant || accessFromAdminGrant
      ? null
      : input.billingStatus ??
        (typeof input.meta.billingStatus === "string"
          ? input.meta.billingStatus
          : null);

  let accessSubtitle: string;
  if (!isPaid) {
    accessSubtitle = "No active subscription";
  } else if (accessFromAffiliateGrant) {
    accessSubtitle = "Affiliate grant";
  } else if (isPlatformAdmin || adminGranted) {
    accessSubtitle = "Complimentary access";
  } else if (accessFromAdminGrant) {
    accessSubtitle = "Admin-assigned plan";
  } else {
    accessSubtitle = "Paid subscription";
  }

  const stripeIsAuthoritative = planCtx.stripeAuthoritative;

  const showPaidStripeControls =
    stripeIsAuthoritative && !isComplimentary && !accessFromAffiliateGrant;

  return {
    planSlug: isPaid ? planSlug : null,
    planLabel,
    isPaid,
    billingStatus,
    adminRoleLabel,
    isComplimentary,
    accessSubtitle,
    showPaidStripeControls,
  };
}
