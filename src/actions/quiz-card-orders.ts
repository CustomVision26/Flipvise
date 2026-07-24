"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/lib/access";
import {
  shuffleQuizCardOrdersForDeck,
  shuffleQuizCardOrdersForWorkspace,
} from "@/db/queries/quiz-card-orders";

async function assertCanManageTeam(userId: string, teamId: number) {
  const { getTeamById, getMemberRecord } = await import("@/db/queries/teams");
  const team = await getTeamById(teamId);
  if (!team) throw new Error("Workspace not found");
  if (team.ownerUserId === userId) return team;
  const member = await getMemberRecord(teamId, userId);
  if (member?.role === "team_admin") return team;
  throw new Error("Forbidden");
}

const shuffleDeckSchema = z.object({
  teamId: z.number().int().positive(),
  deckId: z.number().int().positive(),
});

export async function shuffleDeckQuizCardOrdersAction(
  data: z.infer<typeof shuffleDeckSchema>,
) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = shuffleDeckSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const team = await assertCanManageTeam(userId, parsed.data.teamId);
  const result = await shuffleQuizCardOrdersForDeck(
    parsed.data.teamId,
    parsed.data.deckId,
    team.ownerUserId,
  );

  revalidatePath("/dashboard/team-admin", "layout");
  revalidatePath("/decks", "layout");
  return result;
}

const shuffleWorkspaceSchema = z.object({
  teamId: z.number().int().positive(),
});

export async function shuffleWorkspaceQuizCardOrdersAction(
  data: z.infer<typeof shuffleWorkspaceSchema>,
) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = shuffleWorkspaceSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const team = await assertCanManageTeam(userId, parsed.data.teamId);
  const result = await shuffleQuizCardOrdersForWorkspace(
    parsed.data.teamId,
    team.ownerUserId,
  );

  revalidatePath("/dashboard/team-admin", "layout");
  revalidatePath("/decks", "layout");
  return result;
}
