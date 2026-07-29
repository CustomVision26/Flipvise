import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { teamMembers } from "@/db/schema";
import { getDecksForTeam } from "@/db/queries/teams";
import {
  type EducationTeamPlanId,
  limitsForEducationTeamPlan,
} from "@/lib/education-plans";

export type EducationTeamAdminCreateQuota = {
  createdCount: number;
  /** Effective create cap (owner override or workspace plan max). */
  maxCreateDecks: number;
  /** Raw owner override from `team_members.maxCreateDecks` (null = use plan default). */
  ownerOverride: number | null;
  atLimit: boolean;
};

export async function countDecksCreatedByMemberInTeam(
  teamId: number,
  ownerUserId: string,
  creatorUserId: string,
): Promise<number> {
  const workspaceDecks = await getDecksForTeam(teamId, ownerUserId);
  return workspaceDecks.filter((d) => d.createdByUserId === creatorUserId).length;
}

/**
 * How many decks an Education Gold/Enterprise team admin may still create.
 * Counts only decks they created in the workspace (`createdByUserId`).
 */
export async function resolveEducationTeamAdminCreateQuota(
  teamId: number,
  ownerUserId: string,
  teamAdminUserId: string,
  planSlug: EducationTeamPlanId,
): Promise<EducationTeamAdminCreateQuota> {
  const workspaceMax = limitsForEducationTeamPlan(planSlug).maxDecksPerWorkspace;
  const [member] = await db
    .select({ maxCreateDecks: teamMembers.maxCreateDecks })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, teamAdminUserId),
      ),
    )
    .limit(1);

  const ownerOverride =
    member?.maxCreateDecks != null &&
    Number.isFinite(member.maxCreateDecks) &&
    member.maxCreateDecks > 0
      ? Math.min(member.maxCreateDecks, workspaceMax)
      : null;
  const maxCreateDecks = ownerOverride ?? workspaceMax;
  const createdCount = await countDecksCreatedByMemberInTeam(
    teamId,
    ownerUserId,
    teamAdminUserId,
  );

  return {
    createdCount,
    maxCreateDecks,
    ownerOverride,
    atLimit: maxCreateDecks > 0 && createdCount >= maxCreateDecks,
  };
}

export async function updateTeamMemberMaxCreateDecks(
  teamId: number,
  memberUserId: string,
  maxCreateDecks: number | null,
): Promise<void> {
  await db
    .update(teamMembers)
    .set({
      maxCreateDecks,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, memberUserId),
      ),
    );
}
