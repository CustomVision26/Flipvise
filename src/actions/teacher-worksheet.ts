"use server";

import { getAccessContext } from "@/lib/access";
import { requireTeacherToolsAccess } from "@/lib/teacher-access";
import { getDeckRowById } from "@/db/queries/decks";
import { getCardsForDeckViewer } from "@/db/queries/cards";
import { resolveDeckViewerAccess } from "@/db/queries/teams";
import { buildDeckWorksheetResult } from "@/lib/worksheet-from-deck";
import {
  teacherWorksheetInputSchema,
  type DeckWorksheetResult,
  type TeacherWorksheetActionInput,
} from "@/lib/teacher-worksheet-schema";

export async function generateWorksheetFromDeckAction(
  data: TeacherWorksheetActionInput,
): Promise<DeckWorksheetResult> {
  const ctx = await getAccessContext();
  const { userId } = await requireTeacherToolsAccess(
    ctx,
    "Worksheet Generator requires an education plan.",
  );

  const parsed = teacherWorksheetInputSchema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid input");
  }

  const input = parsed.data;
  const access = await resolveDeckViewerAccess(input.deckId, userId);
  if (!access) {
    throw new Error("Deck not found or you do not have access to it.");
  }

  const deck = await getDeckRowById(input.deckId);
  if (!deck) {
    throw new Error("Deck not found.");
  }

  const cardRows = await getCardsForDeckViewer(input.deckId, userId);
  if (cardRows.length === 0) {
    throw new Error("The selected deck has no cards. Add cards first or choose another deck.");
  }

  return buildDeckWorksheetResult(deck, cardRows, input);
}
