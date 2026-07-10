import { db } from "@/db";
import { savedWorksheets } from "@/db/schema";
import type { SavedWorksheetGenerationInput } from "@/db/schema";
import type { DeckWorksheetResult } from "@/lib/teacher-worksheet-schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type SavedWorksheetRow = InferSelectModel<typeof savedWorksheets>;

export type SaveWorksheetInput = {
  userId: string;
  label: string;
  worksheetTitle: string;
  subject: string;
  gradeLevel: string;
  topic: string;
  worksheetType: string;
  difficultyLevel: string;
  deckId: number;
  sourceDeckName: string;
  input: SavedWorksheetGenerationInput;
  result: DeckWorksheetResult;
  worksheetPdfUrl?: string | null;
  worksheetPdfFileName?: string | null;
  answerKeyPdfUrl?: string | null;
  answerKeyPdfFileName?: string | null;
};

export async function saveWorksheet(data: SaveWorksheetInput): Promise<SavedWorksheetRow> {
  const [row] = await db
    .insert(savedWorksheets)
    .values({
      userId: data.userId,
      label: data.label,
      worksheetTitle: data.worksheetTitle,
      subject: data.subject,
      gradeLevel: data.gradeLevel,
      topic: data.topic,
      worksheetType: data.worksheetType,
      difficultyLevel: data.difficultyLevel,
      deckId: data.deckId,
      sourceDeckName: data.sourceDeckName,
      input: data.input,
      result: data.result,
      worksheetPdfUrl: data.worksheetPdfUrl ?? null,
      worksheetPdfFileName: data.worksheetPdfFileName ?? null,
      answerKeyPdfUrl: data.answerKeyPdfUrl ?? null,
      answerKeyPdfFileName: data.answerKeyPdfFileName ?? null,
    })
    .returning();

  return row;
}

export async function getSavedWorksheetsByUserIds(
  userIds: string[],
): Promise<SavedWorksheetRow[]> {
  if (userIds.length === 0) return [];
  return db
    .select()
    .from(savedWorksheets)
    .where(inArray(savedWorksheets.userId, userIds))
    .orderBy(desc(savedWorksheets.createdAt));
}

export async function getSavedWorksheetById(id: number): Promise<SavedWorksheetRow | null> {
  const [row] = await db
    .select()
    .from(savedWorksheets)
    .where(eq(savedWorksheets.id, id))
    .limit(1);

  return row ?? null;
}

export async function getSavedWorksheetByIdForUser(
  userId: string,
  id: number,
): Promise<SavedWorksheetRow | null> {
  const [row] = await db
    .select()
    .from(savedWorksheets)
    .where(and(eq(savedWorksheets.id, id), eq(savedWorksheets.userId, userId)))
    .limit(1);

  return row ?? null;
}

export async function resolveSavedWorksheetForViewer(
  viewerUserId: string,
  worksheetId: number,
  teamId?: number | null,
): Promise<SavedWorksheetRow | null> {
  const ownWorksheet = await getSavedWorksheetByIdForUser(viewerUserId, worksheetId);
  if (ownWorksheet) return ownWorksheet;

  if (teamId == null) return null;

  const { getTeamById, listTeamMembers } = await import("@/db/queries/teams");
  const team = await getTeamById(teamId);
  if (!team || team.ownerUserId !== viewerUserId) return null;

  const worksheet = await getSavedWorksheetById(worksheetId);
  if (!worksheet) return null;

  const members = await listTeamMembers(teamId);
  const workspaceUserIds = new Set([
    team.ownerUserId,
    ...members.map((member) => member.userId),
  ]);

  if (!workspaceUserIds.has(worksheet.userId)) return null;
  return worksheet;
}

export async function updateSavedWorksheetById(
  worksheetId: number,
  data: {
    label: string;
    worksheetTitle: string;
    subject: string;
    gradeLevel: string;
    topic: string;
    worksheetType: string;
    difficultyLevel: string;
    deckId: number;
    sourceDeckName: string;
    input: SavedWorksheetGenerationInput;
    result: DeckWorksheetResult;
    worksheetPdfUrl?: string | null;
    worksheetPdfFileName?: string | null;
    answerKeyPdfUrl?: string | null;
    answerKeyPdfFileName?: string | null;
  },
): Promise<SavedWorksheetRow | null> {
  const [row] = await db
    .update(savedWorksheets)
    .set({
      label: data.label,
      worksheetTitle: data.worksheetTitle,
      subject: data.subject,
      gradeLevel: data.gradeLevel,
      topic: data.topic,
      worksheetType: data.worksheetType,
      difficultyLevel: data.difficultyLevel,
      deckId: data.deckId,
      sourceDeckName: data.sourceDeckName,
      input: data.input,
      result: data.result,
      worksheetPdfUrl: data.worksheetPdfUrl ?? null,
      worksheetPdfFileName: data.worksheetPdfFileName ?? null,
      answerKeyPdfUrl: data.answerKeyPdfUrl ?? null,
      answerKeyPdfFileName: data.answerKeyPdfFileName ?? null,
      updatedAt: new Date(),
    })
    .where(eq(savedWorksheets.id, worksheetId))
    .returning();

  return row ?? null;
}

export type SavedWorksheetEditItem = {
  id: number;
  label: string;
  deckId: number;
  sourceDeckName: string;
  input: SavedWorksheetGenerationInput;
  result: DeckWorksheetResult;
};

export function mapSavedWorksheetRowToEditItem(row: SavedWorksheetRow): SavedWorksheetEditItem {
  return {
    id: row.id,
    label: row.label,
    deckId: row.deckId,
    sourceDeckName: row.sourceDeckName,
    input: row.input,
    result: row.result,
  };
}

export async function deleteSavedWorksheetById(id: number): Promise<SavedWorksheetRow | null> {
  const [row] = await db.delete(savedWorksheets).where(eq(savedWorksheets.id, id)).returning();
  return row ?? null;
}

export async function getSavedWorksheetsByDeckIdForUser(
  userId: string,
  deckId: number,
): Promise<SavedWorksheetRow[]> {
  return db
    .select()
    .from(savedWorksheets)
    .where(and(eq(savedWorksheets.userId, userId), eq(savedWorksheets.deckId, deckId)))
    .orderBy(desc(savedWorksheets.createdAt));
}
