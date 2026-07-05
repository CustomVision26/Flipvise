import { db } from "@/db";
import { decks, teams } from "@/db/schema";
import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { isLeavingEducationTeamPlan } from "@/lib/plan-transition-limits";

/**
 * When an education team owner leaves an education team tier, co-admin-created decks
 * are reassigned to the owner's personal dashboard with full owner privileges.
 */
export async function transferEducationCoAdminDecksToOwner(
  ownerUserId: string,
  ownedTeamIds: number[],
): Promise<void> {
  if (ownedTeamIds.length === 0) return;

  await db
    .update(decks)
    .set({
      userId: ownerUserId,
      teamId: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(decks.teamId, ownedTeamIds),
        isNotNull(decks.createdByUserId),
        ne(decks.createdByUserId, ownerUserId),
      ),
    );
}

export async function applyAutomaticPlanTransitionEffects(
  ownerUserId: string,
  previousPlanSlug: string | null,
  targetPlanSlug: string | null,
): Promise<void> {
  if (!isLeavingEducationTeamPlan(previousPlanSlug, targetPlanSlug)) return;

  const ownedTeams = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.ownerUserId, ownerUserId));

  await transferEducationCoAdminDecksToOwner(
    ownerUserId,
    ownedTeams.map((t) => t.id),
  );
}
