"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/lib/access";
import { parseDatetimeLocal } from "@/lib/quiz-start-schedule";
import {
  assertDeckInWorkspaceForSchedule,
  updateDeckQuizStartSchedule,
  updateTeamQuizStartSchedule,
} from "@/db/queries/quiz-schedule";

async function assertCanManageTeam(userId: string, teamId: number) {
  const { getTeamById, getMemberRecord } = await import("@/db/queries/teams");
  const team = await getTeamById(teamId);
  if (!team) throw new Error("Workspace not found");
  if (team.ownerUserId === userId) return team;
  const member = await getMemberRecord(teamId, userId);
  if (member?.role === "team_admin") return team;
  throw new Error("Forbidden");
}

const datetimeLocalSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(parseDatetimeLocal(value).getTime()), {
    message: "Invalid date and time",
  });

const updateTeamScheduleSchema = z.object({
  teamId: z.number().int().positive(),
  enabled: z.boolean(),
  startAtLocal: datetimeLocalSchema.optional(),
});

const updateDeckScheduleSchema = z.object({
  teamId: z.number().int().positive(),
  deckId: z.number().int().positive(),
  enabled: z.boolean(),
  startAtLocal: datetimeLocalSchema.optional(),
});

function resolveStartAt(enabled: boolean, startAtLocal: string | undefined): Date | null {
  if (!enabled) {
    return startAtLocal ? parseDatetimeLocal(startAtLocal) : null;
  }
  if (!startAtLocal) {
    throw new Error("Choose a start date and time when scheduling is enabled.");
  }
  return parseDatetimeLocal(startAtLocal);
}

function revalidateQuizSchedulePaths() {
  revalidatePath("/dashboard/team-admin", "layout");
  revalidatePath("/dashboard/team-admin/quiz-results", "layout");
  revalidatePath("/decks", "layout");
}

export async function updateTeamQuizStartScheduleAction(
  data: z.infer<typeof updateTeamScheduleSchema>,
) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = updateTeamScheduleSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  await assertCanManageTeam(userId, parsed.data.teamId);

  const startAt = resolveStartAt(parsed.data.enabled, parsed.data.startAtLocal);
  await updateTeamQuizStartSchedule(parsed.data.teamId, parsed.data.enabled, startAt);
  revalidateQuizSchedulePaths();
}

export async function updateDeckQuizStartScheduleAction(
  data: z.infer<typeof updateDeckScheduleSchema>,
) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = updateDeckScheduleSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const team = await assertCanManageTeam(userId, parsed.data.teamId);
  await assertDeckInWorkspaceForSchedule(
    parsed.data.teamId,
    team.ownerUserId,
    parsed.data.deckId,
  );

  const startAt = resolveStartAt(parsed.data.enabled, parsed.data.startAtLocal);
  await updateDeckQuizStartSchedule(
    parsed.data.deckId,
    team.ownerUserId,
    parsed.data.enabled,
    startAt,
  );
  revalidateQuizSchedulePaths();
}
