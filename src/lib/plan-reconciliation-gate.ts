import { redirect } from "next/navigation";
import { getPendingPlanReconciliationSession } from "@/db/queries/plan-reconciliation";

const RECONCILIATION_PATH = "/dashboard/plan-reconciliation";

export async function redirectIfPlanReconciliationPending(
  userId: string,
  currentPath?: string,
): Promise<void> {
  if (currentPath === RECONCILIATION_PATH) return;

  const pending = await getPendingPlanReconciliationSession(userId);
  if (pending) {
    redirect(RECONCILIATION_PATH);
  }
}

export { RECONCILIATION_PATH };
