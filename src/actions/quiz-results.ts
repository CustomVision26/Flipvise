"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/lib/access";
import { deleteQuizResultForTeamAdmin } from "@/db/queries/quiz-results";

const deleteQuizResultSchema = z.object({
  resultId: z.number().int().positive(),
  teamId: z.number().int().positive(),
});

export async function deleteQuizResultAction(data: z.infer<typeof deleteQuizResultSchema>) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = deleteQuizResultSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { getTeamById, getMemberRecord } = await import("@/db/queries/teams");
  const team = await getTeamById(parsed.data.teamId);
  if (!team) throw new Error("Workspace not found");
  if (team.ownerUserId !== userId) {
    const member = await getMemberRecord(parsed.data.teamId, userId);
    if (member?.role !== "team_admin") throw new Error("Forbidden");
  }

  await deleteQuizResultForTeamAdmin(parsed.data.resultId, parsed.data.teamId);

  revalidatePath("/dashboard/team-admin/quiz-results");
  revalidatePath("/teacher/students");
}
