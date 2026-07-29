import { db } from "@/db";
import {
  essayAssignments,
  essayDocuments,
  essayDrafts,
  essayFeedback,
  essayUsageEvents,
  type EssayAssignmentRow,
  type EssayDocumentRow,
  type EssayDraftRow,
  type EssayFeedbackRow,
} from "@/db/schema";
import type {
  EssayFeedbackResult,
  EssayGenerateInput,
  EssayGenerationResult,
} from "@/lib/essay-ai-schema";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";

export type { EssayAssignmentRow, EssayDocumentRow, EssayDraftRow, EssayFeedbackRow };

export type EssayUsageEventType =
  | "essay_generated"
  | "essay_submitted"
  | "ai_feedback_generated"
  | "draft_saved"
  | "model_essay_revealed";

export async function createEssayDocument(input: {
  userId: string;
  teamId?: number | null;
  title: string;
  subject: string;
  gradeLevel: string;
  essayType: string;
  difficultyLevel: string;
  topic: string;
  learningStandard?: string;
  wordCountTarget: number;
  timeLimitMinutes?: number;
  generationInput: EssayGenerateInput;
  result: EssayGenerationResult;
}): Promise<EssayDocumentRow> {
  const now = new Date();
  const [row] = await db
    .insert(essayDocuments)
    .values({
      userId: input.userId,
      teamId: input.teamId ?? null,
      title: input.title,
      subject: input.subject,
      gradeLevel: input.gradeLevel,
      essayType: input.essayType,
      difficultyLevel: input.difficultyLevel,
      topic: input.topic,
      learningStandard: input.learningStandard ?? "",
      wordCountTarget: input.wordCountTarget,
      timeLimitMinutes: input.timeLimitMinutes ?? 0,
      status: "ready",
      input: input.generationInput,
      result: input.result,
      modelEssayRevealed: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) throw new Error("Failed to create essay document");
  return row;
}

export async function getEssayDocumentByIdForUser(
  documentId: number,
  userId: string,
): Promise<EssayDocumentRow | null> {
  const [owned] = await db
    .select()
    .from(essayDocuments)
    .where(and(eq(essayDocuments.id, documentId), eq(essayDocuments.userId, userId)))
    .limit(1);
  if (owned) return owned;

  const [assigned] = await db
    .select({ document: essayDocuments })
    .from(essayAssignments)
    .innerJoin(essayDocuments, eq(essayAssignments.documentId, essayDocuments.id))
    .where(
      and(
        eq(essayAssignments.documentId, documentId),
        eq(essayAssignments.assigneeUserId, userId),
      ),
    )
    .limit(1);
  return assigned?.document ?? null;
}

export async function listEssayDocumentsForUser(
  userId: string,
): Promise<EssayDocumentRow[]> {
  return db
    .select()
    .from(essayDocuments)
    .where(eq(essayDocuments.userId, userId))
    .orderBy(desc(essayDocuments.updatedAt));
}

export async function listRecentEssayDocumentsForUser(
  userId: string,
  limit = 5,
): Promise<EssayDocumentRow[]> {
  return db
    .select()
    .from(essayDocuments)
    .where(eq(essayDocuments.userId, userId))
    .orderBy(desc(essayDocuments.updatedAt))
    .limit(limit);
}

export async function upsertEssayDraft(input: {
  documentId: number;
  userId: string;
  body: string;
  wordCount: number;
}): Promise<EssayDraftRow> {
  const now = new Date();
  const [row] = await db
    .insert(essayDrafts)
    .values({
      documentId: input.documentId,
      userId: input.userId,
      body: input.body,
      wordCount: input.wordCount,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [essayDrafts.userId, essayDrafts.documentId],
      set: {
        body: input.body,
        wordCount: input.wordCount,
        // Keep submitted status if already submitted — callers should use submit instead.
        updatedAt: now,
      },
    })
    .returning();
  if (!row) throw new Error("Failed to save essay draft");
  return row;
}

export async function submitEssayDraft(input: {
  documentId: number;
  userId: string;
  body: string;
  wordCount: number;
}): Promise<EssayDraftRow> {
  const now = new Date();
  const [row] = await db
    .insert(essayDrafts)
    .values({
      documentId: input.documentId,
      userId: input.userId,
      body: input.body,
      wordCount: input.wordCount,
      status: "submitted",
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [essayDrafts.userId, essayDrafts.documentId],
      set: {
        body: input.body,
        wordCount: input.wordCount,
        status: "submitted",
        submittedAt: now,
        updatedAt: now,
      },
    })
    .returning();
  if (!row) throw new Error("Failed to submit essay");
  return row;
}

export async function getEssayDraftForUser(
  documentId: number,
  userId: string,
): Promise<EssayDraftRow | null> {
  const [row] = await db
    .select()
    .from(essayDrafts)
    .where(
      and(eq(essayDrafts.documentId, documentId), eq(essayDrafts.userId, userId)),
    )
    .limit(1);
  return row ?? null;
}

export async function listEssayDraftsForUser(userId: string): Promise<
  Array<EssayDraftRow & { documentTitle: string }>
> {
  const rows = await db
    .select({
      draft: essayDrafts,
      documentTitle: essayDocuments.title,
    })
    .from(essayDrafts)
    .innerJoin(essayDocuments, eq(essayDrafts.documentId, essayDocuments.id))
    .where(and(eq(essayDrafts.userId, userId), eq(essayDrafts.status, "draft")))
    .orderBy(desc(essayDrafts.updatedAt));
  return rows.map((r) => ({ ...r.draft, documentTitle: r.documentTitle }));
}

export async function createEssayFeedback(input: {
  documentId: number;
  draftId: number;
  userId: string;
  result: EssayFeedbackResult;
}): Promise<EssayFeedbackRow> {
  const [row] = await db
    .insert(essayFeedback)
    .values({
      documentId: input.documentId,
      draftId: input.draftId,
      userId: input.userId,
      result: input.result,
      createdAt: new Date(),
    })
    .returning();
  if (!row) throw new Error("Failed to save essay feedback");
  return row;
}

export async function listRecentEssayFeedbackForUser(
  userId: string,
  limit = 5,
): Promise<EssayFeedbackRow[]> {
  return db
    .select()
    .from(essayFeedback)
    .where(eq(essayFeedback.userId, userId))
    .orderBy(desc(essayFeedback.createdAt))
    .limit(limit);
}

export async function getLatestEssayFeedbackForDraft(
  draftId: number,
  userId: string,
): Promise<EssayFeedbackRow | null> {
  const [row] = await db
    .select()
    .from(essayFeedback)
    .where(and(eq(essayFeedback.draftId, draftId), eq(essayFeedback.userId, userId)))
    .orderBy(desc(essayFeedback.createdAt))
    .limit(1);
  return row ?? null;
}

export async function createEssayAssignment(input: {
  teamId: number;
  documentId: number;
  assigneeUserId: string;
  assignedByUserId: string;
  dueAt?: Date | null;
}): Promise<EssayAssignmentRow> {
  const now = new Date();
  const [row] = await db
    .insert(essayAssignments)
    .values({
      teamId: input.teamId,
      documentId: input.documentId,
      assigneeUserId: input.assigneeUserId,
      assignedByUserId: input.assignedByUserId,
      status: "assigned",
      dueAt: input.dueAt ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        essayAssignments.teamId,
        essayAssignments.documentId,
        essayAssignments.assigneeUserId,
      ],
      set: {
        assignedByUserId: input.assignedByUserId,
        status: "assigned",
        dueAt: input.dueAt ?? null,
        updatedAt: now,
      },
    })
    .returning();
  if (!row) throw new Error("Failed to create essay assignment");
  return row;
}

export async function listEssayAssignmentsForUser(userId: string): Promise<
  Array<EssayAssignmentRow & { documentTitle: string; subject: string }>
> {
  const rows = await db
    .select({
      assignment: essayAssignments,
      documentTitle: essayDocuments.title,
      subject: essayDocuments.subject,
    })
    .from(essayAssignments)
    .innerJoin(essayDocuments, eq(essayAssignments.documentId, essayDocuments.id))
    .where(eq(essayAssignments.assigneeUserId, userId))
    .orderBy(desc(essayAssignments.createdAt));
  return rows.map((r) => ({
    ...r.assignment,
    documentTitle: r.documentTitle,
    subject: r.subject,
  }));
}

export async function revealModelEssayForOwner(
  documentId: number,
  userId: string,
): Promise<EssayDocumentRow | null> {
  const [row] = await db
    .update(essayDocuments)
    .set({ modelEssayRevealed: true, updatedAt: new Date() })
    .where(and(eq(essayDocuments.id, documentId), eq(essayDocuments.userId, userId)))
    .returning();
  return row ?? null;
}

export async function recordEssayUsageEvent(input: {
  userId: string;
  eventType: EssayUsageEventType;
  documentId?: number | null;
  draftId?: number | null;
  tokensUsed?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(essayUsageEvents).values({
    userId: input.userId,
    addonKey: "ai_essay",
    eventType: input.eventType,
    documentId: input.documentId ?? null,
    draftId: input.draftId ?? null,
    tokensUsed: input.tokensUsed ?? 0,
    metadata: input.metadata ?? null,
    createdAt: new Date(),
  });
}

export async function countEssayUsageByType(): Promise<
  Array<{ eventType: string; count: number; tokensUsed: number }>
> {
  const rows = await db
    .select({
      eventType: essayUsageEvents.eventType,
      count: sql<number>`count(*)::int`,
      tokensUsed: sql<number>`coalesce(sum(${essayUsageEvents.tokensUsed}), 0)::int`,
    })
    .from(essayUsageEvents)
    .groupBy(essayUsageEvents.eventType);
  return rows;
}

export async function listActiveEssayUserIds(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: essayUsageEvents.userId })
    .from(essayUsageEvents);
  return rows.map((r) => r.userId);
}

export async function deleteEssayDataForUser(userId: string): Promise<void> {
  await db.delete(essayFeedback).where(eq(essayFeedback.userId, userId));
  await db.delete(essayDrafts).where(eq(essayDrafts.userId, userId));
  await db
    .delete(essayAssignments)
    .where(
      or(
        eq(essayAssignments.assigneeUserId, userId),
        eq(essayAssignments.assignedByUserId, userId),
      ),
    );
  await db.delete(essayDocuments).where(eq(essayDocuments.userId, userId));
  await db.delete(essayUsageEvents).where(eq(essayUsageEvents.userId, userId));
}

export async function getEssayDocumentsByIds(
  ids: number[],
): Promise<EssayDocumentRow[]> {
  if (ids.length === 0) return [];
  return db.select().from(essayDocuments).where(inArray(essayDocuments.id, ids));
}
