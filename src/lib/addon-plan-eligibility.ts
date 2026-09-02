import { canonicalTeamPlanId } from "@/lib/team-plans";

/** Access fields used to decide whether a user may purchase an add-on. */
export type AddonEligibilityAccess = {
  effectivePlanSlug?: string | null;
  isAdmin?: boolean;
  adminGranted?: boolean;
  hasClerkPersonalProPlus?: boolean;
  hasClerkPersonalPro?: boolean;
  activeTeamPlan?: string | null;
  activeEducationTeamPlan?: string | null;
};

function pushEligibilitySlug(slugs: string[], value: string | null | undefined) {
  const slug = value?.trim();
  if (!slug || slug === "free") return;
  if (!slugs.includes(slug)) slugs.push(slug);
}

/**
 * Every paid plan this access context can use for add-on eligibility.
 * Personal, team, education-team, and complimentary Pro Plus are all considered —
 * a complimentary admin Pro Plus must not hide an active Team Gold workspace.
 */
export function listAddonEligibilityPlanSlugs(
  access: AddonEligibilityAccess,
): string[] {
  const slugs: string[] = [];
  pushEligibilitySlug(slugs, access.effectivePlanSlug);
  pushEligibilitySlug(slugs, access.activeTeamPlan);
  pushEligibilitySlug(slugs, access.activeEducationTeamPlan);
  if (access.isAdmin || access.adminGranted) {
    pushEligibilitySlug(slugs, "pro_plus");
  }
  if (access.hasClerkPersonalProPlus) {
    pushEligibilitySlug(slugs, "pro_plus");
  }
  if (access.hasClerkPersonalPro) {
    pushEligibilitySlug(slugs, "pro");
  }
  return slugs;
}

/**
 * Plan slug used for add-on purchase / Stripe-entitlement eligibility.
 *
 * Platform admins and complimentary unlocks have Pro Plus features without a
 * Stripe `billingPlan`, so treat them as `pro_plus` when metadata has no paid slug.
 */
export function resolvePlanSlugForAddonEligibility(
  access: AddonEligibilityAccess,
): string | null {
  const slug = access.effectivePlanSlug?.trim();
  if (slug && slug !== "free") return slug;
  if (access.activeTeamPlan) return access.activeTeamPlan;
  if (access.activeEducationTeamPlan) return access.activeEducationTeamPlan;
  if (access.isAdmin || access.adminGranted) return "pro_plus";
  if (access.hasClerkPersonalProPlus) return "pro_plus";
  if (access.hasClerkPersonalPro) return "pro";
  return null;
}

/** True when the user's effective plan slug is listed on the add-on catalog row. */
export function isPlanEligibleForAddon(
  eligiblePlanIds: string[],
  effectivePlanSlug: string | null | undefined,
): boolean {
  if (!effectivePlanSlug) return false;
  if (eligiblePlanIds.includes(effectivePlanSlug)) return true;
  // Accept legacy team slugs when the catalog lists canonical ids (and vice versa).
  const canonical = canonicalTeamPlanId(effectivePlanSlug);
  if (canonical && eligiblePlanIds.includes(canonical)) return true;
  for (const id of eligiblePlanIds) {
    if (canonicalTeamPlanId(id) === effectivePlanSlug) return true;
    if (canonical && canonicalTeamPlanId(id) === canonical) return true;
  }
  return false;
}

export function isAccessEligibleForAddon(
  eligiblePlanIds: string[],
  access: AddonEligibilityAccess,
): boolean {
  return listAddonEligibilityPlanSlugs(access).some((slug) =>
    isPlanEligibleForAddon(eligiblePlanIds, slug),
  );
}
