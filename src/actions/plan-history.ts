"use server";

import { auth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { getMergedPlanHistoryForUser } from "@/db/queries/plan-history";
import type { PlanHistoryRow } from "@/lib/plan-history-types";

export type { PlanHistoryRow } from "@/lib/plan-history-types";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

/**
 * Billing tab data load — must not use `@/lib/clerk-auth` here: those helpers call
 * `redirect()` on stale sessions, which breaks the Server Action POST envelope and
 * surfaces as “An unexpected response was received from the server.”
 *
 * Avoid `currentUser()` in Server Actions for the same reason; resolve email via
 * Clerk Backend API when needed.
 */
async function resolveUserEmailForPlanHistory(
  userId: string,
): Promise<string | null> {
  if (!process.env.CLERK_SECRET_KEY) return null;
  try {
    const user = await clerkClient.users.getUser(userId);
    const primary = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId,
    )?.emailAddress;
    const fallback = user.emailAddresses[0]?.emailAddress;
    return (primary ?? fallback)?.toLowerCase() ?? null;
  } catch (error) {
    console.error("[plan-history] resolveUserEmailForPlanHistory:", error);
    return null;
  }
}

export async function loadUserPlanHistoryAction(): Promise<PlanHistoryRow[]> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return [];
    }

    const email = await resolveUserEmailForPlanHistory(userId);
    return await getMergedPlanHistoryForUser(userId, email);
  } catch (error) {
    console.error("[loadUserPlanHistoryAction]", error);
    return [];
  }
}
