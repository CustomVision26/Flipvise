"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/lib/access";
import { getCardsByDeckUnscoped } from "@/db/queries/cards";
import { getDeckRowById } from "@/db/queries/decks";
import { getMemberRecord, getTeamById } from "@/db/queries/teams";
import { getQuizResultForTeamAdmin } from "@/db/queries/quiz-results";
import { saveQuizSheet } from "@/db/queries/saved-quizzes";
import { isEducationTeamPlanId } from "@/lib/education-plans";
import { parseCardQuizVariants } from "@/lib/card-quiz-variants";
import { buildAnswerKeyOptionsByCardId } from "@/lib/quiz-answer-key-options";
import {
  generateQuizAttemptSheetPdfBuffer,
  quizAttemptSheetPdfSafeFileName,
  type QuizAttemptSheetPdfData,
} from "@/lib/quiz-attempt-sheet-pdf-build";
import { uploadQuizSheetPdfBufferToS3 } from "@/lib/s3";

const quizResultSheetsSchema = z.object({
  resultId: z.number().int().positive(),
  teamId: z.number().int().positive(),
});

async function assertTeamQuizResultAccess(userId: string, teamId: number) {
  const team = await getTeamById(teamId);
  if (!team) throw new Error("Workspace not found");
  if (team.ownerUserId !== userId) {
    const member = await getMemberRecord(teamId, userId);
    if (member?.role !== "team_admin") throw new Error("Forbidden");
  }
  return team;
}

function deriveSubjectFromDeckName(deckName: string): string {
  const parts = deckName.split(/\s*[—–-]\s*/);
  return parts[0]?.trim() || deckName;
}

async function buildPdfData(
  result: NonNullable<Awaited<ReturnType<typeof getQuizResultForTeamAdmin>>>,
  memberLabel?: string | null,
  memberEmail?: string | null,
): Promise<QuizAttemptSheetPdfData> {
  const perCard = result.perCard ?? [];
  const deckCards =
    result.deckId != null ? await getCardsByDeckUnscoped(result.deckId) : [];

  return {
    deckName: result.deckName,
    memberLabel,
    memberEmail,
    savedAt: result.savedAt,
    perCard,
    answerKeyOptionsByCardId: buildAnswerKeyOptionsByCardId(
      perCard,
      deckCards.map((card) => ({
        id: card.id,
        front: card.front,
        back: card.back,
        choices: card.choices,
        correctChoiceIndex: card.correctChoiceIndex,
        choiceImageUrls: card.choiceImageUrls,
        quizVariants: parseCardQuizVariants(card.quizVariants),
      })),
    ),
  };
}

export async function previewQuizResultSheetsAction(data: z.infer<typeof quizResultSheetsSchema>) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = quizResultSheetsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  await assertTeamQuizResultAccess(userId, parsed.data.teamId);

  const result = await getQuizResultForTeamAdmin(parsed.data.resultId, parsed.data.teamId);
  if (!result) throw new Error("Quiz result not found");
  if (!result.perCard || result.perCard.length === 0) {
    throw new Error("This quiz result has no question breakdown to export.");
  }

  const pdfData = await buildPdfData(result);
  const [questionBuffer, answerKeyBuffer] = await Promise.all([
    generateQuizAttemptSheetPdfBuffer(pdfData, "question_sheet"),
    generateQuizAttemptSheetPdfBuffer(pdfData, "answer_key"),
  ]);

  return {
    deckName: result.deckName,
    questionCount: result.perCard.length,
    questionSheetPdfBase64: questionBuffer.toString("base64"),
    answerKeyPdfBase64: answerKeyBuffer.toString("base64"),
    canSave: false as boolean,
  };
}

const saveQuizResultSheetsSchema = quizResultSheetsSchema.extend({
  memberLabel: z.string().nullable().optional(),
  memberEmail: z.string().nullable().optional(),
  label: z.string().trim().min(1).max(255).optional(),
});

export async function saveQuizResultSheetsAction(data: z.infer<typeof saveQuizResultSheetsSchema>) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = saveQuizResultSheetsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const team = await assertTeamQuizResultAccess(userId, parsed.data.teamId);
  if (!isEducationTeamPlanId(team.planSlug)) {
    throw new Error("Saving quiz sheets requires Education Gold or Education Enterprise.");
  }

  const result = await getQuizResultForTeamAdmin(parsed.data.resultId, parsed.data.teamId);
  if (!result) throw new Error("Quiz result not found");
  if (!result.perCard || result.perCard.length === 0) {
    throw new Error("This quiz result has no question breakdown to export.");
  }

  const deck = result.deckId != null ? await getDeckRowById(result.deckId) : null;
  const subject = deriveSubjectFromDeckName(result.deckName);
  const gradeLevel = deck?.gradeLevel?.trim() || "General";
  const label = parsed.data.label?.trim() || `${result.deckName} Quiz Sheet`;
  const title = label;

  const pdfData = await buildPdfData(result, parsed.data.memberLabel, parsed.data.memberEmail);
  const questionSheetPdfFileName = `${quizAttemptSheetPdfSafeFileName(title, "question_sheet")}.pdf`;
  const answerKeyPdfFileName = `${quizAttemptSheetPdfSafeFileName(title, "answer_key")}.pdf`;

  const [questionBuffer, answerKeyBuffer] = await Promise.all([
    generateQuizAttemptSheetPdfBuffer(pdfData, "question_sheet"),
    generateQuizAttemptSheetPdfBuffer(pdfData, "answer_key"),
  ]);

  const [questionSheetPdfUrl, answerKeyPdfUrl] = await Promise.all([
    uploadQuizSheetPdfBufferToS3({
      userId,
      fileName: questionSheetPdfFileName,
      buffer: questionBuffer,
      variant: "question_sheet",
    }),
    uploadQuizSheetPdfBufferToS3({
      userId,
      fileName: answerKeyPdfFileName,
      buffer: answerKeyBuffer,
      variant: "answer_key",
    }),
  ]);

  const saved = await saveQuizSheet({
    userId,
    teamId: parsed.data.teamId,
    quizResultId: result.id,
    deckId: result.deckId,
    label,
    title,
    subject,
    gradeLevel,
    sourceDeckName: result.deckName,
    memberLabel: parsed.data.memberLabel ?? null,
    memberEmail: parsed.data.memberEmail ?? null,
    perCard: result.perCard,
    questionSheetPdfUrl,
    questionSheetPdfFileName,
    answerKeyPdfUrl,
    answerKeyPdfFileName,
  });

  revalidatePath("/teacher/resources");
  revalidatePath("/dashboard/team-admin/quiz-results");

  return {
    id: saved.id,
    label: saved.label,
    questionSheetPdfUrl: saved.questionSheetPdfUrl,
    answerKeyPdfUrl: saved.answerKeyPdfUrl,
  };
}

export async function previewQuizResultSheetsForRowAction(
  data: z.infer<typeof quizResultSheetsSchema> & { workspacePlanSlug: string },
) {
  const preview = await previewQuizResultSheetsAction(data);
  return {
    ...preview,
    canSave: isEducationTeamPlanId(data.workspacePlanSlug),
  };
}
