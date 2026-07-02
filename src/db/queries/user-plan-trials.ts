import { db } from "@/db";
import { userPlanTrials } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getUserPlanTrial(userId: string) {
  const rows = await db
    .select()
    .from(userPlanTrials)
    .where(eq(userPlanTrials.userId, userId));
  return rows[0] ?? null;
}

export async function hasUserConsumedPlanTrial(userId: string): Promise<boolean> {
  const row = await getUserPlanTrial(userId);
  return row != null;
}

export async function recordUserPlanTrial(input: {
  userId: string;
  planSlug: string;
  stripeSubscriptionId: string;
  trialEndsAt: Date;
}) {
  await db
    .insert(userPlanTrials)
    .values({
      userId: input.userId,
      planSlug: input.planSlug,
      stripeSubscriptionId: input.stripeSubscriptionId,
      trialEndsAt: input.trialEndsAt,
    })
    .onConflictDoNothing();
}

export async function listUserPlanTrialsForAdmin() {
  try {
    return await db.select().from(userPlanTrials);
  } catch {
    return [];
  }
}

export async function deleteUserPlanTrial(userId: string) {
  await db.delete(userPlanTrials).where(eq(userPlanTrials.userId, userId));
}
