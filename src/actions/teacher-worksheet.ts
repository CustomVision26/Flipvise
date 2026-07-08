"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAccessContext } from "@/lib/access";
import { requireTeacherToolsAccess } from "@/lib/teacher-access";
import { getDeckRowById } from "@/db/queries/decks";
import { saveWorksheet } from "@/db/queries/saved-worksheets";
import { resolveDeckViewerAccess } from "@/db/queries/teams";
import { uploadWorksheetPdfBufferToS3 } from "@/lib/s3";
import {
  generateWorksheetPdfBuffer,
  worksheetPdfSafeFileName,
} from "@/lib/worksheet-pdf-build";
import {
  savedWorksheetResultSchema,
  teacherWorksheetInputSchema,
  type DeckWorksheetResult,
  type TeacherWorksheetActionInput,
} from "@/lib/teacher-worksheet-schema";
import { buildDeckWorksheetResult } from "@/lib/worksheet-from-deck";
import { getCardsForDeckViewer } from "@/db/queries/cards";

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

const saveWorksheetSchema = z.object({
  label: z.string().min(1).max(255),
  input: teacherWorksheetInputSchema,
  result: savedWorksheetResultSchema,
});

export async function saveWorksheetAction(data: {
  label: string;
  input: TeacherWorksheetActionInput;
  result: DeckWorksheetResult;
}): Promise<{
  id: number;
  label: string;
  worksheetPdfUrl: string | null;
  answerKeyPdfUrl: string | null;
  sourceDeckName: string;
}> {
  const ctx = await getAccessContext();
  const { userId } = await requireTeacherToolsAccess(
    ctx,
    "Worksheet Generator requires an education plan.",
  );

  const parsed = saveWorksheetSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid worksheet data");
  }

  const payload = parsed.data;
  const access = await resolveDeckViewerAccess(payload.input.deckId, userId);
  if (!access) {
    throw new Error("Deck not found or you do not have access to it.");
  }

  const deck = await getDeckRowById(payload.input.deckId);
  if (!deck) {
    throw new Error("Deck not found.");
  }

  const worksheetPdfFileName = `${worksheetPdfSafeFileName(payload.result.worksheetTitle, "worksheet")}.pdf`;
  const answerKeyPdfFileName = `${worksheetPdfSafeFileName(payload.result.worksheetTitle, "answer_key")}.pdf`;
  let worksheetPdfUrl: string | null = null;
  let answerKeyPdfUrl: string | null = null;

  try {
    const worksheetBuffer = await generateWorksheetPdfBuffer(payload.result, "worksheet");
    worksheetPdfUrl = await uploadWorksheetPdfBufferToS3({
      userId,
      fileName: worksheetPdfFileName,
      buffer: worksheetBuffer,
      variant: "worksheet",
    });

    const answerKeyBuffer = await generateWorksheetPdfBuffer(payload.result, "answer_key");
    answerKeyPdfUrl = await uploadWorksheetPdfBufferToS3({
      userId,
      fileName: answerKeyPdfFileName,
      buffer: answerKeyBuffer,
      variant: "answer_key",
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[saveWorksheetAction] PDF upload skipped or failed; saving worksheet without PDFs.",
        error,
      );
    }
  }

  const saved = await saveWorksheet({
    userId,
    label: payload.label.trim(),
    worksheetTitle: payload.result.worksheetTitle,
    subject: payload.input.subject,
    gradeLevel: payload.input.gradeLevel,
    topic: payload.input.topic,
    worksheetType: payload.input.worksheetType,
    difficultyLevel: payload.input.difficultyLevel,
    deckId: payload.input.deckId,
    sourceDeckName: deck.name,
    input: {
      deckId: payload.input.deckId,
      subject: payload.input.subject,
      gradeLevel: payload.input.gradeLevel,
      topic: payload.input.topic,
      worksheetType: payload.input.worksheetType,
      difficultyLevel: payload.input.difficultyLevel,
    },
    result: payload.result,
    worksheetPdfUrl,
    worksheetPdfFileName,
    answerKeyPdfUrl,
    answerKeyPdfFileName,
  });

  revalidatePath("/teacher/resources");
  revalidatePath("/teacher/worksheets");

  return {
    id: saved.id,
    label: saved.label,
    worksheetPdfUrl: saved.worksheetPdfUrl,
    answerKeyPdfUrl: saved.answerKeyPdfUrl,
    sourceDeckName: saved.sourceDeckName,
  };
}
