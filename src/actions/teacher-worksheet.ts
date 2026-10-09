"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAccessContext } from "@/lib/access";
import { requireTeacherToolsAccess } from "@/lib/teacher-access";
import { runWithAiUsageContext } from "@/lib/ai-usage/track";
import { getDeckRowById } from "@/db/queries/decks";
import { saveWorksheet, updateSavedWorksheetById, resolveSavedWorksheetForViewer } from "@/db/queries/saved-worksheets";
import { resolveSavedLessonPlanForViewer } from "@/db/queries/saved-lesson-plans";
import { resolveDeckViewerAccess } from "@/db/queries/teams";
import { getLessonPlanReferenceMaterials } from "@/lib/lesson-plan-reference-material";
import {
  formatLessonPlanContextForPrompt,
  normalizeLessonPlanContext,
} from "@/lib/lesson-plan-context";
import {
  formatLessonPlanDayScopeLabel,
  isLessonPlanDayScopeAll,
} from "@/lib/lesson-plan-day-scope";
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
import { buildLessonPlanWorksheetResult } from "@/lib/worksheet-from-deck";
import { generateWorksheetItemsFromLessonPlan } from "@/lib/worksheet-ai";
import {
  isNextControlFlowError,
  userFacingServerActionError,
} from "@/lib/server-action-client-error";

export type GenerateWorksheetActionResult =
  | { ok: true; worksheet: DeckWorksheetResult }
  | { ok: false; error: string };

function worksheetActionError(error: unknown, fallback: string): string {
  console.error("[generateWorksheetFromDeckAction]", error);
  return userFacingServerActionError(error, fallback);
}

export async function generateWorksheetFromDeckAction(
  data: TeacherWorksheetActionInput,
): Promise<GenerateWorksheetActionResult> {
  try {
    const ctx = await getAccessContext();
    const { userId } = await requireTeacherToolsAccess(
      ctx,
      "Worksheet Generator requires an education plan.",
    );

    const parsed = teacherWorksheetInputSchema.safeParse(data);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return { ok: false, error: first?.message ?? "Invalid input" };
    }

    const input = parsed.data;
    if (input.savedLessonPlanId == null) {
      return { ok: false, error: "Select a saved lesson plan." };
    }

    const savedPlan = await resolveSavedLessonPlanForViewer(
      userId,
      input.savedLessonPlanId,
      input.teamId,
    );
    if (!savedPlan) {
      return { ok: false, error: "Saved lesson plan not found." };
    }

    const dayScope = input.dayScope ?? "all";
    if (!isLessonPlanDayScopeAll(dayScope)) {
      const scheduleLength = savedPlan.result.weeklySchedule?.length ?? 0;
      if (dayScope.dayIndex >= scheduleLength) {
        return {
          ok: false,
          error:
            "Selected lesson-plan day is not available on this plan. Choose All Days or another day.",
        };
      }
    }

    const referenceMaterials = getLessonPlanReferenceMaterials(savedPlan.input);
    const curriculum = normalizeLessonPlanContext({
      lessonPlanId: savedPlan.id,
      input: savedPlan.input,
      result: savedPlan.result,
      dayScope,
      overrides: {
        subject: input.subject,
        gradeLevel: input.gradeLevel,
        topic: input.topic,
      },
    });
    const scopedDayIndex = isLessonPlanDayScopeAll(dayScope) ? null : dayScope.dayIndex;
    const scopedDay =
      scopedDayIndex != null
        ? savedPlan.result.weeklySchedule?.[scopedDayIndex] ?? null
        : null;
    const dayScopeLabel = scopedDay && scopedDayIndex != null
      ? formatLessonPlanDayScopeLabel(scopedDay, scopedDayIndex)
      : "All Days";

    const linkedDeck =
      savedPlan.deckId != null ? await getDeckRowById(savedPlan.deckId) : null;

    const worksheet = await runWithAiUsageContext(
      {
        userId,
        feature: "worksheet",
        teamId: linkedDeck?.teamId ?? input.teamId ?? null,
        subscriptionPlan: ctx.effectivePlanSlug,
        isPlatformAdmin: ctx.isAdmin || ctx.isSuperadmin,
      },
      async () => {
        const items = await generateWorksheetItemsFromLessonPlan({
          curriculumContext: formatLessonPlanContextForPrompt(curriculum),
          numberOfQuestions: input.numberOfQuestions,
          subject: input.subject,
          gradeLevel: input.gradeLevel,
          topic: input.topic,
          worksheetType: input.worksheetType,
          difficultyLevel: input.difficultyLevel,
          dayScopeLabel,
        });

        if (items.length === 0) {
          throw new Error("Could not build worksheet questions from this lesson plan.");
        }

        return buildLessonPlanWorksheetResult(
          {
            subject: input.subject,
            gradeLevel: input.gradeLevel,
            topic: input.topic,
            worksheetType: input.worksheetType,
            difficultyLevel: input.difficultyLevel,
            lessonTitle: savedPlan.lessonTitle,
            dayScope,
          },
          { referenceMaterials, items },
        );
      },
    );

    return { ok: true, worksheet };
  } catch (error) {
    if (isNextControlFlowError(error)) throw error;
    return {
      ok: false,
      error: worksheetActionError(
        error,
        "Worksheet generation failed. Please try again.",
      ),
    };
  }
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
  const deckId = payload.input.deckId;
  if (deckId == null) {
    throw new Error("This lesson plan is not linked to a deck, so the worksheet cannot be saved yet.");
  }
  const access = await resolveDeckViewerAccess(deckId, userId);
  if (!access) {
    throw new Error("Deck not found or you do not have access to it.");
  }

  const deck = await getDeckRowById(deckId);
  if (!deck) {
    throw new Error("Deck not found.");
  }

  const referenceMaterials = await resolveReferenceMaterialsForWorksheetDeck(
    userId,
    deckId,
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
    deckId,
    sourceDeckName: payload.result.deckName || deck.name,
    input: {
      deckId,
      savedLessonPlanId: payload.input.savedLessonPlanId,
      dayScope: payload.input.dayScope,
      subject: payload.input.subject,
      gradeLevel: payload.input.gradeLevel,
      topic: payload.input.topic,
      worksheetType: payload.input.worksheetType,
      difficultyLevel: payload.input.difficultyLevel,
      numberOfQuestions: payload.input.numberOfQuestions,
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
      savedLessonPlanId: payload.input.savedLessonPlanId,
      dayScope: payload.input.dayScope,
      subject: payload.input.subject,
      gradeLevel: payload.input.gradeLevel,
      topic: payload.input.topic,
      worksheetType: payload.input.worksheetType,
      difficultyLevel: payload.input.difficultyLevel,
      numberOfQuestions: payload.input.numberOfQuestions,
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
