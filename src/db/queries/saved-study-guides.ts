import { db } from "@/db";
import { savedStudyGuides } from "@/db/schema";
import type { SavedStudyGuideGenerationInput } from "@/db/schema";
import type { StudyGuideResult } from "@/lib/teacher-generators";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type SavedStudyGuideRow = InferSelectModel<typeof savedStudyGuides>;

export type SaveStudyGuideInput = {
  userId: string;
  label: string;
  guideTitle: string;
  subject: string;
  gradeLevel: string;
  topic: string;
  savedLessonPlanId?: number | null;
  sourceLessonPlanTitle?: string | null;
  savedHomeworkId?: number | null;
  sourceHomeworkLabel?: string | null;
  input: SavedStudyGuideGenerationInput;
  result: StudyGuideResult;
  pdfUrl?: string | null;
  pdfFileName?: string | null;
};

export async function saveStudyGuide(data: SaveStudyGuideInput): Promise<SavedStudyGuideRow> {
  const [row] = await db
    .insert(savedStudyGuides)
    .values({
      userId: data.userId,
      label: data.label,
      guideTitle: data.guideTitle,
      subject: data.subject,
      gradeLevel: data.gradeLevel,
      topic: data.topic,
      savedLessonPlanId: data.savedLessonPlanId ?? null,
      sourceLessonPlanTitle: data.sourceLessonPlanTitle ?? null,
      savedHomeworkId: data.savedHomeworkId ?? null,
      sourceHomeworkLabel: data.sourceHomeworkLabel ?? null,
      input: data.input,
      result: data.result,
      pdfUrl: data.pdfUrl ?? null,
      pdfFileName: data.pdfFileName ?? null,
    })
    .returning();

  return row;
}

export async function getSavedStudyGuidesByUserIds(
  userIds: string[],
): Promise<SavedStudyGuideRow[]> {
  if (userIds.length === 0) return [];
  return db
    .select()
    .from(savedStudyGuides)
    .where(inArray(savedStudyGuides.userId, userIds))
    .orderBy(desc(savedStudyGuides.createdAt));
}

export async function getSavedStudyGuideByIdForUser(
  userId: string,
  id: number,
): Promise<SavedStudyGuideRow | null> {
  const [row] = await db
    .select()
    .from(savedStudyGuides)
    .where(and(eq(savedStudyGuides.id, id), eq(savedStudyGuides.userId, userId)))
    .limit(1);

  return row ?? null;
}
