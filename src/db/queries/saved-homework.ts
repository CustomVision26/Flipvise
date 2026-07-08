import { db } from "@/db";
import { savedHomeworkAssignments } from "@/db/schema";
import type { SavedHomeworkGenerationInput } from "@/db/schema";
import type { HomeworkResult } from "@/lib/teacher-homework-ai-schema";
import { desc, eq, and, inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type SavedHomeworkRow = InferSelectModel<typeof savedHomeworkAssignments>;

export type SaveHomeworkAssignmentInput = {
  userId: string;
  label: string;
  assignmentTitle: string;
  subject: string;
  gradeLevel: string;
  topic: string;
  difficultyLevel: string;
  sourceType: SavedHomeworkGenerationInput["sourceType"];
  savedLessonPlanId?: number | null;
  sourceLessonPlanTitle?: string | null;
  deckId?: number | null;
  sourceDeckName?: string | null;
  input: SavedHomeworkGenerationInput;
  result: HomeworkResult;
  pdfUrl?: string | null;
  pdfFileName?: string | null;
};

export async function saveHomeworkAssignment(
  data: SaveHomeworkAssignmentInput,
): Promise<SavedHomeworkRow> {
  const [row] = await db
    .insert(savedHomeworkAssignments)
    .values({
      userId: data.userId,
      label: data.label,
      assignmentTitle: data.assignmentTitle,
      subject: data.subject,
      gradeLevel: data.gradeLevel,
      topic: data.topic,
      difficultyLevel: data.difficultyLevel,
      sourceType: data.sourceType,
      savedLessonPlanId: data.savedLessonPlanId ?? null,
      sourceLessonPlanTitle: data.sourceLessonPlanTitle ?? null,
      deckId: data.deckId ?? null,
      sourceDeckName: data.sourceDeckName ?? null,
      input: data.input,
      result: data.result,
      pdfUrl: data.pdfUrl ?? null,
      pdfFileName: data.pdfFileName ?? null,
    })
    .returning();

  return row;
}

export async function getSavedHomeworkAssignmentsByUser(
  userId: string,
): Promise<SavedHomeworkRow[]> {
  return db
    .select()
    .from(savedHomeworkAssignments)
    .where(eq(savedHomeworkAssignments.userId, userId))
    .orderBy(desc(savedHomeworkAssignments.createdAt));
}

export async function getSavedHomeworkAssignmentsByUserIds(
  userIds: string[],
): Promise<SavedHomeworkRow[]> {
  if (userIds.length === 0) return [];
  return db
    .select()
    .from(savedHomeworkAssignments)
    .where(inArray(savedHomeworkAssignments.userId, userIds))
    .orderBy(desc(savedHomeworkAssignments.createdAt));
}

export async function getSavedHomeworkAssignmentByIdForUser(
  userId: string,
  id: number,
): Promise<SavedHomeworkRow | null> {
  const [row] = await db
    .select()
    .from(savedHomeworkAssignments)
    .where(
      and(eq(savedHomeworkAssignments.id, id), eq(savedHomeworkAssignments.userId, userId)),
    )
    .limit(1);

  return row ?? null;
}

export async function getSavedHomeworkAssignmentById(
  id: number,
): Promise<SavedHomeworkRow | null> {
  const [row] = await db
    .select()
    .from(savedHomeworkAssignments)
    .where(eq(savedHomeworkAssignments.id, id))
    .limit(1);

  return row ?? null;
}

export async function deleteSavedHomeworkAssignmentById(
  id: number,
): Promise<SavedHomeworkRow | null> {
  const [row] = await db
    .delete(savedHomeworkAssignments)
    .where(eq(savedHomeworkAssignments.id, id))
    .returning();

  return row ?? null;
}

export async function resolveSavedHomeworkForViewer(
  viewerUserId: string,
  homeworkId: number,
  teamId?: number | null,
): Promise<SavedHomeworkRow | null> {
  const ownHomework = await getSavedHomeworkAssignmentByIdForUser(viewerUserId, homeworkId);
  if (ownHomework) return ownHomework;

  if (teamId == null) return null;

  const { getTeamById, listTeamMembers } = await import("@/db/queries/teams");
  const team = await getTeamById(teamId);
  if (!team || team.ownerUserId !== viewerUserId) return null;

  const homework = await getSavedHomeworkAssignmentById(homeworkId);
  if (!homework) return null;

  const members = await listTeamMembers(teamId);
  const workspaceUserIds = new Set([
    team.ownerUserId,
    ...members.map((member) => member.userId),
  ]);

  if (!workspaceUserIds.has(homework.userId)) return null;
  return homework;
}

export type SavedHomeworkPickerItem = {
  id: number;
  label: string;
  assignmentTitle: string;
  savedLessonPlanId: number | null;
  sourceLessonPlanTitle: string | null;
  sourceType: string;
  inputSavedLessonPlanId: number | null;
  deckId: number | null;
  sourceDeckName: string | null;
  inputDeckId: number | null;
  subject: string;
  gradeLevel: string;
  topic: string;
};

export function mapSavedHomeworkRowToPickerItem(row: SavedHomeworkRow): SavedHomeworkPickerItem {
  return {
    id: row.id,
    label: row.label,
    assignmentTitle: row.assignmentTitle,
    savedLessonPlanId: row.savedLessonPlanId,
    sourceLessonPlanTitle: row.sourceLessonPlanTitle,
    sourceType: row.sourceType,
    inputSavedLessonPlanId: row.input.savedLessonPlanId ?? null,
    deckId: row.deckId,
    sourceDeckName: row.sourceDeckName,
    inputDeckId: row.input.deckId ?? null,
    subject: row.subject,
    gradeLevel: row.gradeLevel,
    topic: row.topic,
  };
}

export async function getSavedHomeworkForPicker(
  userId: string,
): Promise<SavedHomeworkPickerItem[]> {
  const rows = await getSavedHomeworkAssignmentsByUser(userId);
  return rows.map(mapSavedHomeworkRowToPickerItem);
}

export async function listSavedHomeworkPdfUrlsForUser(userId: string): Promise<string[]> {
  const rows = await db
    .select({ pdfUrl: savedHomeworkAssignments.pdfUrl })
    .from(savedHomeworkAssignments)
    .where(eq(savedHomeworkAssignments.userId, userId));

  return rows
    .map((row) => row.pdfUrl?.trim())
    .filter((url): url is string => Boolean(url));
}
