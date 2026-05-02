"use server";

import { auth, currentUser } from "@/lib/clerk-auth";
import {
  getMergedPlanHistoryForUser,
  type PlanHistoryRow,
} from "@/db/queries/plan-history";

export type { PlanHistoryRow };

export async function loadUserPlanHistoryAction(): Promise<PlanHistoryRow[]> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;

  return getMergedPlanHistoryForUser(userId, email);
}
