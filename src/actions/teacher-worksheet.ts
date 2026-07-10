"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAccessContext } from "@/lib/access";
import { requireTeacherToolsAccess } from "@/lib/teacher-access";
import { getDeckRowById } from "@/db/queries/decks";
import { saveWorksheet, updateSavedWorksheetById, resolveSavedWorksheetForViewer } from "@/db/queries/saved-worksheets";
import { getSavedLessonPlanByDeckIdForUser } from "@/db/queries/saved-lesson-plans";
import { resolveDeckViewerAccess } from "@/db/queries/teams";
import { getLessonPlanReferenceMaterials } from "@/lib/lesson-plan-reference-material";
import { uploadWorksheetPdfBufferToS3, deleteFromS3 } from "@/lib/s3";
import { resolveReferenceMaterialsForWorksheetDeck } from "@/lib/resolve-saved-resource-references";
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

  const linkedLessonPlan = await getSavedLessonPlanByDeckIdForUser(userId, input.deckId);
  const referenceMaterials = getLessonPlanReferenceMaterials(linkedLessonPlan?.input);

  return buildDeckWorksheetResult(deck, cardRows, input, { referenceMaterials });
}

const saveWorksheetSchema = z.object({
  label: z.string().min(1).max(255),
  input: teacherWorksheetInputSchema,
  result: savedWorksheetResultSchema,
});

const updateWorksheetSchema = saveWorksheetSchema.extend({
  worksheetId: z.number().int().positive(),
});

async function uploadWorksheetPdfs(
  userId: string,
  result: DeckWorksheetResult,
): Promise<{
  worksheetPdfUrl: string | null;
  worksheetPdfFileName: string | null;
  answerKeyPdfUrl: string | null;
  answerKeyPdfFileName: string | null;
}> {
  const worksheetPdfFileName = `${worksheetPdfSafeFileName(result.worksheetTitle, "worksheet")}.pdf`;
  const answerKeyPdfFileName = `${worksheetPdfSafeFileName(result.worksheetTitle, "answer_key")}.pdf`;
  let worksheetPdfUrl: string | null = null;
  let answerKeyPdfUrl: string | null = null;

  try {
    const worksheetBuffer = await generateWorksheetPdfBuffer(result, "worksheet");
    worksheetPdfUrl = await uploadWorksheetPdfBufferToS3({
      userId,
      fileName: worksheetPdfFileName,
      buffer: worksheetBuffer,
      variant: "worksheet",
    });

    const answerKeyBuffer = await generateWorksheetPdfBuffer(result, "answer_key");
    answerKeyPdfUrl = await uploadWorksheetPdfBufferToS3({
      userId,
      fileName: answerKeyPdfFileName,
      buffer: answerKeyBuffer,
      variant: "answer_key",
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[uploadWorksheetPdfs] PDF upload skipped or failed.",
        error,
      );
    }
  }

  return {
    worksheetPdfUrl,
    worksheetPdfFileName,
    answerKeyPdfUrl,
    answerKeyPdfFileName,
  };
}

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

  const referenceMaterials = await resolveReferenceMaterialsForWorksheetDeck(
    userId,
    payload.input.deckId,
  );

  const pdfs = await uploadWorksheetPdfs(userId, payload.result);

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
      referenceMaterials:
        referenceMaterials.length > 0 ? referenceMaterials : undefined,
    },
    result: payload.result,
    worksheetPdfUrl: pdfs.worksheetPdfUrl,
    worksheetPdfFileName: pdfs.worksheetPdfFileName,
    answerKeyPdfUrl: pdfs.answerKeyPdfUrl,
    answerKeyPdfFileName: pdfs.answerKeyPdfFileName,
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

export async function updateWorksheetAction(data: {
  worksheetId: number;
  label: string;
  input: TeacherWorksheetActionInput;
  result: DeckWorksheetResult;
  teamId?: number;
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

  const parsed = updateWorksheetSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid worksheet data");
  }

  const existing = await resolveSavedWorksheetForViewer(
    userId,
    parsed.data.worksheetId,
    data.teamId,
  );
  if (!existing) {
    throw new Error("Worksheet not found.");
  }

  const payload = parsed.data;
  const access = await resolveDeckViewerAccess(existing.deckId, userId);
  if (!access) {
    throw new Error("Deck not found or you do not have access to it.");
  }

  const deck = await getDeckRowById(existing.deckId);
  if (!deck) {
    throw new Error("Deck not found.");
  }

  const referenceMaterials = await resolveReferenceMaterialsForWorksheetDeck(
    userId,
    existing.deckId,
  );

  const pdfs = await uploadWorksheetPdfs(existing.userId, payload.result);

  if (pdfs.worksheetPdfUrl && existing.worksheetPdfUrl && existing.worksheetPdfUrl !== pdfs.worksheetPdfUrl) {
    try {
      await deleteFromS3(existing.worksheetPdfUrl);
    } catch {
      // proceed even if old PDF removal fails
    }
  }
  if (pdfs.answerKeyPdfUrl && existing.answerKeyPdfUrl && existing.answerKeyPdfUrl !== pdfs.answerKeyPdfUrl) {
    try {
      await deleteFromS3(existing.answerKeyPdfUrl);
    } catch {
      // proceed even if old PDF removal fails
    }
  }

  const updated = await updateSavedWorksheetById(parsed.data.worksheetId, {
    label: payload.label.trim(),
    worksheetTitle: payload.result.worksheetTitle,
    subject: payload.input.subject,
    gradeLevel: payload.input.gradeLevel,
    topic: payload.input.topic,
    worksheetType: payload.input.worksheetType,
    difficultyLevel: payload.input.difficultyLevel,
    deckId: existing.deckId,
    sourceDeckName: deck.name,
    input: {
      deckId: existing.deckId,
      subject: payload.input.subject,
      gradeLevel: payload.input.gradeLevel,
      topic: payload.input.topic,
      worksheetType: payload.input.worksheetType,
      difficultyLevel: payload.input.difficultyLevel,
      referenceMaterials:
        referenceMaterials.length > 0 ? referenceMaterials : undefined,
    },
    result: payload.result,
    worksheetPdfUrl: pdfs.worksheetPdfUrl ?? existing.worksheetPdfUrl,
    worksheetPdfFileName: pdfs.worksheetPdfFileName ?? existing.worksheetPdfFileName,
    answerKeyPdfUrl: pdfs.answerKeyPdfUrl ?? existing.answerKeyPdfUrl,
    answerKeyPdfFileName: pdfs.answerKeyPdfFileName ?? existing.answerKeyPdfFileName,
  });

  if (!updated) {
    throw new Error("Could not update worksheet.");
  }

  revalidatePath("/teacher/resources");
  revalidatePath("/teacher/worksheets");

  return {
    id: updated.id,
    label: updated.label,
    worksheetPdfUrl: updated.worksheetPdfUrl,
    answerKeyPdfUrl: updated.answerKeyPdfUrl,
    sourceDeckName: updated.sourceDeckName,
  };
}
