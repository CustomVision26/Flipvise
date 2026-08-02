import { canonicalTeamPlanId } from "@/lib/team-plans";

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
