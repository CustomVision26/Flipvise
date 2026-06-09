import { isStripePaidPlanId } from "@/lib/billing-plan-ids";
import {
  isClerkPlatformAdminRole,
  isClerkSuperadminRole,
} from "@/lib/clerk-platform-admin-role";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import { resolveEffectivePlan } from "@/lib/plan-metadata-billing-resolution";

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

/** Mirrors header / `getAccessContext()` complimentary unlock for Account → Billing. */
export function resolveBillingTabPlanDisplay(input: {
  meta: Record<string, unknown>;
  stripePlanSlug: string | null;
  billingStatus: string | null;
}): BillingTabPlanDisplay {
  const role = typeof input.meta.role === "string" ? input.meta.role : null;
  const adminGranted = input.meta.adminGranted === true;
  const adminPlan =
    typeof input.meta.adminPlan === "string" ? input.meta.adminPlan.trim() : null;

  const isSuperadmin = isClerkSuperadminRole(role);
  const isPlatformAdmin = isClerkPlatformAdminRole(role);
  const adminRoleLabel = isSuperadmin
    ? "Superadmin"
    : isPlatformAdmin
      ? "Platform Admin"
      : null;

  const stripeSlug = input.stripePlanSlug?.trim() || null;
  const effectiveSlug = resolveEffectivePlan(input.meta);

  let planSlug = stripeSlug ?? effectiveSlug;
  if (!planSlug && (isPlatformAdmin || adminGranted)) {
    planSlug = "pro_plus";
  }

  const isPaid = planSlug != null && planSlug !== "free";
  const planLabel = isPaid
    ? displayNameForBillingPlanSlug(planSlug)
    : "Free";

  const billingStatus =
    input.billingStatus ??
    (typeof input.meta.billingStatus === "string"
      ? input.meta.billingStatus
      : null);

  const isComplimentary =
    isPaid &&
    !stripeSlug &&
    (isPlatformAdmin ||
      adminGranted ||
      (!!adminPlan && effectiveSlug === adminPlan));

  const accessSubtitle = !isPaid
    ? "No active subscription"
    : isComplimentary
      ? "Complimentary access"
      : "Paid subscription";

  const isPaidStripePlan =
    stripeSlug != null && isStripePaidPlanId(stripeSlug);
  const showPaidStripeControls = isPaidStripePlan && !isComplimentary;

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
