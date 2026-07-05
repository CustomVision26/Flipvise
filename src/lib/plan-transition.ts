import { applyAutomaticPlanTransitionEffects } from "@/lib/plan-transition-effects";
import { maybeRequirePlanReconciliation } from "@/db/queries/plan-reconciliation";

/**
 * Runs automatic plan-change effects (education deck transfer) and opens a
 * reconciliation session when usage exceeds the new plan limits.
 */
export async function handlePlanTransition(
  ownerUserId: string,
  previousPlanSlug: string | null,
  targetPlanSlug: string | null,
): Promise<void> {
  if (previousPlanSlug === targetPlanSlug) return;

  await applyAutomaticPlanTransitionEffects(
    ownerUserId,
    previousPlanSlug,
    targetPlanSlug,
  );
  await maybeRequirePlanReconciliation(
    ownerUserId,
    targetPlanSlug,
    previousPlanSlug,
  );
}
