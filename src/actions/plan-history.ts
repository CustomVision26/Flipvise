"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { getMergedPlanHistoryForUser } from "@/db/queries/plan-history";
import type { PlanHistoryRow } from "@/lib/plan-history-types";

export type { PlanHistoryRow } from "@/lib/plan-history-types";

/**
 * Billing tab data load — must not use `@/lib/clerk-auth` here: those helpers call
 * `redirect()` on stale sessions, which breaks the Server Action POST envelope and
 * surfaces as “An unexpected response was received from the server.”
 */
export async function loadUserPlanHistoryAction(): Promise<PlanHistoryRow[]> {
  const { userId } = await auth();
  if (!userId) {
    return [];
  }

  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;

  return getMergedPlanHistoryForUser(userId, email);
}
