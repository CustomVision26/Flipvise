import {
  hasProPlusFeatures,
  isEducationTeamPlanId,
} from "@/lib/education-plans";
import { isTeamPlanId, type TeamPlanId } from "@/lib/team-plans";

/**
 * AI Recall™ is limited to Pro Plus–tier and education plans:
 * - Pro Plus, Education Plus
 * - Consumer team tiers (Team Basic / Gold / Platinum / Enterprise)
 * - Education Gold / Education Enterprise
 * - Platform administrators (complimentary)
 *
 * Free and standard Pro do NOT include AI Recall™.
 */
export function resolveAiRecallAccess(input: {
  isPlatformAdmin?: boolean;
  activeTeamPlan?: TeamPlanId | null;
  activeEducationTeamPlan?: string | null;
  /** Resolved personal / effective paid slug. */
  personalPlanSlug?: string | null;
  /** Clerk JWT `has({ plan: "pro_plus" })`. */
  hasClerkProPlusPlan?: boolean;
  /** When studying inside a team workspace, the workspace plan slug. */
  studyWorkspacePlanSlug?: string | null;
}): boolean {
  if (input.isPlatformAdmin) return true;
  if (input.activeTeamPlan != null && isTeamPlanId(input.activeTeamPlan)) {
    return true;
  }
  if (
    input.activeEducationTeamPlan != null &&
    isEducationTeamPlanId(input.activeEducationTeamPlan)
  ) {
    return true;
  }
  if (input.hasClerkProPlusPlan) return true;
  if (hasProPlusFeatures(input.personalPlanSlug)) return true;

  const workspace = input.studyWorkspacePlanSlug?.trim() ?? "";
  if (workspace && (isTeamPlanId(workspace) || isEducationTeamPlanId(workspace))) {
    return true;
  }

  return false;
}
