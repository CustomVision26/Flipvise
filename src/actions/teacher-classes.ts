"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/lib/access";
import { requireTeacherToolsAccess } from "@/lib/teacher-access";
import {
  createTeacherClass,
  getTeacherClassById,
  updateTeacherClassById,
} from "@/db/queries/teacher-classes";
import { getPlanPeriodDaysForDeckForUser } from "@/db/queries/saved-lesson-plans";
import { getTeamById } from "@/db/queries/teams";
import { loadTeacherDeckContext } from "@/lib/load-teacher-deck-quota";
import {
  createTeacherClassSchema,
  updateTeacherClassSchema,
  type CreateTeacherClassInput,
  type UpdateTeacherClassInput,
} from "@/lib/teacher-class-schema";

async function assertCanManageTeacherClass(
  viewerUserId: string,
  ownerUserId: string,
  teamId: number | null,
): Promise<void> {
  if (ownerUserId === viewerUserId) return;

  if (teamId == null) {
    throw new Error("Forbidden");
  }

  const team = await getTeamById(teamId);
  if (!team || team.ownerUserId !== viewerUserId) {
    throw new Error("Forbidden");
  }
}

export async function createTeacherClassAction(input: CreateTeacherClassInput) {
  const parsed = createTeacherClassSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid class details.");
  }

  const ctx = await getAccessContext();
  const { userId } = await requireTeacherToolsAccess(
    ctx,
    "Teacher classes require an Education plan or workspace access.",
  );

  const deckContext = await loadTeacherDeckContext(userId);
  const deck = deckContext.decks.find((row) => row.id === parsed.data.deckId);
  if (!deck) {
    throw new Error("Selected deck is not available in this workspace.");
  }

  const teamId = parsed.data.teamId ?? deckContext.teamId ?? null;
  if (deckContext.teamId != null && teamId !== deckContext.teamId) {
    throw new Error("Class must use a deck from the active workspace.");
  }

  await createTeacherClass(userId, {
    teamId,
    deckId: parsed.data.deckId,
    academicYear: parsed.data.academicYear,
    termSemester: parsed.data.termSemester,
    week: parsed.data.week,
    day: parsed.data.day,
    period: parsed.data.period,
  });

  revalidatePath("/teacher/classes");
}

const getTeacherClassDeckPlanPeriodSchema = z.object({
  deckId: z.number().int().positive("Select a deck."),
});

export async function getTeacherClassDeckPlanPeriodAction(
  input: z.infer<typeof getTeacherClassDeckPlanPeriodSchema>,
): Promise<number | null> {
  const parsed = getTeacherClassDeckPlanPeriodSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid deck.");
  }

  const ctx = await getAccessContext();
  const { userId } = await requireTeacherToolsAccess(
    ctx,
    "Teacher classes require an Education plan or workspace access.",
  );

  const deckContext = await loadTeacherDeckContext(userId);
  const deck = deckContext.decks.find((row) => row.id === parsed.data.deckId);
  if (!deck) {
    return null;
  }

  return getPlanPeriodDaysForDeckForUser(userId, parsed.data.deckId, deckContext.decks);
}

export async function updateTeacherClassAction(input: UpdateTeacherClassInput) {
  const parsed = updateTeacherClassSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid class details.");
  }

  const ctx = await getAccessContext();
  const { userId } = await requireTeacherToolsAccess(
    ctx,
    "Teacher classes require an Education plan or workspace access.",
  );

  const existing = await getTeacherClassById(parsed.data.classId);
  if (!existing) {
    throw new Error("Class not found");
  }

  const teamId = parsed.data.teamId ?? existing.teamId ?? null;
  await assertCanManageTeacherClass(userId, existing.userId, teamId);

  const deckContext = await loadTeacherDeckContext(userId);
  const deck = deckContext.decks.find((row) => row.id === parsed.data.deckId);
  if (!deck) {
    throw new Error("Selected deck is not available in this workspace.");
  }

  if (deckContext.teamId != null && teamId !== deckContext.teamId) {
    throw new Error("Class must use a deck from the active workspace.");
  }

  await updateTeacherClassById(parsed.data.classId, {
    deckId: parsed.data.deckId,
    academicYear: parsed.data.academicYear,
    termSemester: parsed.data.termSemester,
    week: parsed.data.week,
    day: parsed.data.day,
    period: parsed.data.period,
  });

  revalidatePath("/teacher/classes");
}
