import { db } from "@/db";
import { savedLessonPlans } from "@/db/schema";
import type { LessonPlanInput, LessonPlanResult } from "@/lib/teacher-generators";
import { desc, eq, and } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type SavedLessonPlanRow = InferSelectModel<typeof savedLessonPlans>;

export type SaveLessonPlanInput = {
  userId: string;
  input: LessonPlanInput;
  result: LessonPlanResult;
  pdfUrl?: string | null;
  pdfFileName?: string | null;
};

export async function saveLessonPlan(
  data: SaveLessonPlanInput,
): Promise<SavedLessonPlanRow> {
  const [row] = await db
    .insert(savedLessonPlans)
    .values({
      userId: data.userId,
      lessonTitle: data.result.lessonTitle,
      subject: data.input.subject,
      gradeLevel: data.input.gradeLevel,
      topic: data.input.topic,
      difficultyLevel: data.input.difficultyLevel,
      input: data.input,
      result: data.result,
      pdfUrl: data.pdfUrl ?? null,
      pdfFileName: data.pdfFileName ?? null,
    })
    .returning();

  return row;
}

export async function getSavedLessonPlansByUser(
  userId: string,
): Promise<SavedLessonPlanRow[]> {
  return db
    .select()
    .from(savedLessonPlans)
    .where(eq(savedLessonPlans.userId, userId))
    .orderBy(desc(savedLessonPlans.createdAt));
}

export async function getSavedLessonPlanByIdForUser(
  userId: string,
  id: number,
): Promise<SavedLessonPlanRow | null> {
  const [row] = await db
    .select()
    .from(savedLessonPlans)
    .where(and(eq(savedLessonPlans.id, id), eq(savedLessonPlans.userId, userId)))
    .limit(1);

  return row ?? null;
}

export type SavedLessonPlanPickerItem = {
  id: number;
  lessonTitle: string;
  subject: string;
  gradeLevel: string;
  topic: string;
  difficultyLevel: string;
  pdfUrl: string | null;
  input: LessonPlanInput;
  result: LessonPlanResult;
};

export async function getSavedLessonPlansForQuizPicker(
  userId: string,
): Promise<SavedLessonPlanPickerItem[]> {
  const rows = await getSavedLessonPlansByUser(userId);
  return rows.map((row) => ({
    id: row.id,
    lessonTitle: row.lessonTitle,
    subject: row.subject,
    gradeLevel: row.gradeLevel,
    topic: row.topic,
    difficultyLevel: row.difficultyLevel,
    pdfUrl: row.pdfUrl,
    input: row.input,
    result: row.result,
  }));
}
