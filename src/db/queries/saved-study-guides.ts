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

export async function getSavedStudyGuideById(id: number): Promise<SavedStudyGuideRow | null> {
  const [row] = await db
    .select()
    .from(savedStudyGuides)
    .where(eq(savedStudyGuides.id, id))
    .limit(1);

  return row ?? null;
}

export async function resolveSavedStudyGuideForViewer(
  viewerUserId: string,
  studyGuideId: number,
  teamId?: number | null,
): Promise<SavedStudyGuideRow | null> {
  const ownGuide = await getSavedStudyGuideByIdForUser(viewerUserId, studyGuideId);
  if (ownGuide) return ownGuide;

  if (teamId == null) return null;

  const { getTeamById, listTeamMembers } = await import("@/db/queries/teams");
  const team = await getTeamById(teamId);
  if (!team || team.ownerUserId !== viewerUserId) return null;

  const guide = await getSavedStudyGuideById(studyGuideId);
  if (!guide) return null;

  const members = await listTeamMembers(teamId);
  const workspaceUserIds = new Set([
    team.ownerUserId,
    ...members.map((member) => member.userId),
  ]);

  if (!workspaceUserIds.has(guide.userId)) return null;
  return guide;
}

export async function updateSavedStudyGuideById(
  studyGuideId: number,
  data: {
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
  },
): Promise<SavedStudyGuideRow | null> {
  const [row] = await db
    .update(savedStudyGuides)
    .set({
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
      updatedAt: new Date(),
    })
    .where(eq(savedStudyGuides.id, studyGuideId))
    .returning();

  return row ?? null;
}

export type SavedStudyGuideEditItem = {
  id: number;
  label: string;
  savedLessonPlanId: number | null;
  savedHomeworkId: number | null;
  sourceLessonPlanTitle: string | null;
  sourceHomeworkLabel: string | null;
  input: SavedStudyGuideGenerationInput;
  result: StudyGuideResult;
};

export function mapSavedStudyGuideRowToEditItem(
  row: SavedStudyGuideRow,
): SavedStudyGuideEditItem {
  return {
    id: row.id,
    label: row.label,
    savedLessonPlanId: row.savedLessonPlanId,
    savedHomeworkId: row.savedHomeworkId,
    sourceLessonPlanTitle: row.sourceLessonPlanTitle,
    sourceHomeworkLabel: row.sourceHomeworkLabel,
    input: row.input,
    result: row.result,
  };
}
