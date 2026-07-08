"use server";

import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/lib/access";
import { requireTeacherToolsAccess } from "@/lib/teacher-access";
import { createTeacherClass } from "@/db/queries/teacher-classes";
import { loadTeacherDeckContext } from "@/lib/load-teacher-deck-quota";
import {
  createTeacherClassSchema,
  type CreateTeacherClassInput,
} from "@/lib/teacher-class-schema";

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
