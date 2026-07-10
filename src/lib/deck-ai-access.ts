import type { AccessContext } from "@/lib/access";
import { hasEducationPlan } from "@/lib/education-plans";

/** User-facing note when deck AI (distractors, generate answer, etc.) is gated. */
export const DECK_AI_PLAN_REQUIREMENT =
  "AI features require Pro, Pro Plus, Education Plus, or a team-tier workspace plan.";

/**
 * Whether the user may run deck-level AI (generate answer, distractors, bulk cards, etc.).
 *
 * Covers personal Pro / Pro Plus, Education Plus (and education team metadata on the session),
 * and decks linked to consumer or education team-tier workspaces.
 */
export function canUseDeckAiFeatures(
  access: Pick<
    AccessContext,
    | "hasAI"
    | "canAccessTeacherTools"
    | "hasClerkPersonalPro"
    | "hasClerkPersonalProPlus"
    | "effectivePlanSlug"
    | "activeTeamPlan"
    | "activeEducationTeamPlan"
  >,
  workspaceTeamTierAi: boolean,
): boolean {
  if (access.hasAI) return true;
  if (workspaceTeamTierAi) return true;
  if (access.activeTeamPlan !== null || access.activeEducationTeamPlan !== null) return true;
  if (access.hasClerkPersonalPro || access.hasClerkPersonalProPlus) return true;
  if (access.canAccessTeacherTools) return true;

  const slug = access.effectivePlanSlug?.trim() ?? "";
  if (slug === "pro" || slug === "pro_plus") return true;
  if (hasEducationPlan(slug)) return true;

  return false;
}
