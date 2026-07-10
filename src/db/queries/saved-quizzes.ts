import { db } from "@/db";
import { savedQuizzes } from "@/db/schema";
import type { PerCardSnapshot } from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type SavedQuizRow = InferSelectModel<typeof savedQuizzes>;

export type SaveQuizSheetInput = {
  userId: string;
  teamId: number | null;
  quizResultId: number | null;
  deckId: number | null;
  label: string;
  title: string;
  subject: string;
  gradeLevel: string;
  sourceDeckName: string;
  memberLabel?: string | null;
  memberEmail?: string | null;
  perCard: PerCardSnapshot[];
  questionSheetPdfUrl?: string | null;
  questionSheetPdfFileName?: string | null;
  answerKeyPdfUrl?: string | null;
  answerKeyPdfFileName?: string | null;
};

export async function saveQuizSheet(data: SaveQuizSheetInput): Promise<SavedQuizRow> {
  const [row] = await db
    .insert(savedQuizzes)
    .values({
      userId: data.userId,
      teamId: data.teamId,
      quizResultId: data.quizResultId,
      deckId: data.deckId,
      label: data.label,
      title: data.title,
      subject: data.subject,
      gradeLevel: data.gradeLevel,
      sourceDeckName: data.sourceDeckName,
      memberLabel: data.memberLabel ?? null,
      memberEmail: data.memberEmail ?? null,
      perCard: data.perCard,
      questionSheetPdfUrl: data.questionSheetPdfUrl ?? null,
      questionSheetPdfFileName: data.questionSheetPdfFileName ?? null,
      answerKeyPdfUrl: data.answerKeyPdfUrl ?? null,
      answerKeyPdfFileName: data.answerKeyPdfFileName ?? null,
    })
    .returning();

  return row;
}

export async function getSavedQuizzesByUserIds(userIds: string[]): Promise<SavedQuizRow[]> {
  if (userIds.length === 0) return [];
  return db
    .select()
    .from(savedQuizzes)
    .where(inArray(savedQuizzes.userId, userIds))
    .orderBy(desc(savedQuizzes.createdAt));
}

export async function getSavedQuizById(id: number): Promise<SavedQuizRow | null> {
  const [row] = await db.select().from(savedQuizzes).where(eq(savedQuizzes.id, id)).limit(1);
  return row ?? null;
}

export async function getSavedQuizByIdForUser(
  userId: string,
  id: number,
): Promise<SavedQuizRow | null> {
  const [row] = await db
    .select()
    .from(savedQuizzes)
    .where(and(eq(savedQuizzes.id, id), eq(savedQuizzes.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function deleteSavedQuizById(id: number): Promise<void> {
  await db.delete(savedQuizzes).where(eq(savedQuizzes.id, id));
}
