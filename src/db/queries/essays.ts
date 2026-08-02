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
import { isEssayCitationFormattedSaved } from "@/lib/document-generation-studio";
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

export async function countEssayDocumentsForUser(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(essayDocuments)
    .where(eq(essayDocuments.userId, userId));
  return row?.count ?? 0;
}

export async function upsertEssayDraft(input: {
  documentId: number;
  userId: string;
  body: string;
  wordCount: number;
  sectionsContent?: Record<string, string>;
}): Promise<EssayDraftRow> {
  const now = new Date();
  const sectionsContent = input.sectionsContent ?? {};
  const [row] = await db
    .insert(essayDrafts)
    .values({
      documentId: input.documentId,
      userId: input.userId,
      body: input.body,
      wordCount: input.wordCount,
      sectionsContent,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [essayDrafts.userId, essayDrafts.documentId],
      set: {
        body: input.body,
        wordCount: input.wordCount,
        sectionsContent,
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
  sectionsContent?: Record<string, string>;
}): Promise<EssayDraftRow> {
  const now = new Date();
  const sectionsContent = input.sectionsContent ?? {};
  const [row] = await db
    .insert(essayDrafts)
    .values({
      documentId: input.documentId,
      userId: input.userId,
      body: input.body,
      wordCount: input.wordCount,
      sectionsContent,
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
        sectionsContent,
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

/** Reopen a submitted (or existing) draft for editing; upserts content when provided. */
export async function reopenEssayDraftForEdit(input: {
  documentId: number;
  userId: string;
  body?: string;
  wordCount?: number;
  sectionsContent?: Record<string, string>;
}): Promise<EssayDraftRow> {
  const existing = await getEssayDraftForUser(input.documentId, input.userId);
  const now = new Date();
  const body = input.body ?? existing?.body ?? "";
  const sectionsContent =
    input.sectionsContent ??
    (existing?.sectionsContent as Record<string, string> | undefined) ??
    {};
  const wordCount =
    input.wordCount ??
    existing?.wordCount ??
    (body.trim() ? body.trim().split(/\s+/).length : 0);

  const [row] = await db
    .insert(essayDrafts)
    .values({
      documentId: input.documentId,
      userId: input.userId,
      body,
      wordCount,
      sectionsContent,
      status: "draft",
      submittedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [essayDrafts.userId, essayDrafts.documentId],
      set: {
        body,
        wordCount,
        sectionsContent,
        status: "draft",
        submittedAt: null,
        updatedAt: now,
      },
    })
    .returning();
  if (!row) throw new Error("Failed to reopen essay draft");
  return row;
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

/**
 * Essays available for the Citation & Formatting pool — same set as My Essays
 * (all generated documents owned by the user), with optional draft metadata.
 */
export async function listEssaysForCitationFormattingPool(userId: string): Promise<
  Array<{
    documentId: number;
    title: string;
    subject: string;
    gradeLevel: string;
    essayType: string;
    wordCount: number;
    submittedAt: Date | null;
    input: EssayDocumentRow["input"];
  }>
> {
  const rows = await db
    .select({
      documentId: essayDocuments.id,
      title: essayDocuments.title,
      subject: essayDocuments.subject,
      gradeLevel: essayDocuments.gradeLevel,
      essayType: essayDocuments.essayType,
      wordCount: essayDrafts.wordCount,
      submittedAt: essayDrafts.submittedAt,
      input: essayDocuments.input,
    })
    .from(essayDocuments)
    .leftJoin(
      essayDrafts,
      and(
        eq(essayDrafts.documentId, essayDocuments.id),
        eq(essayDrafts.userId, userId),
      ),
    )
    .where(eq(essayDocuments.userId, userId))
    .orderBy(desc(essayDocuments.updatedAt));

  return rows.map((row) => ({
    ...row,
    wordCount: row.wordCount ?? 0,
  }));
}

/** Persist citation / Document Studio formatting on an owned essay. */
export async function updateEssayDocumentStudioForOwner(input: {
  documentId: number;
  userId: string;
  generationInput: EssayGenerateInput;
}): Promise<EssayDocumentRow | null> {
  const existing = await getEssayDocumentByIdForUser(
    input.documentId,
    input.userId,
  );
  if (!existing || existing.userId !== input.userId) return null;

  const [row] = await db
    .update(essayDocuments)
    .set({
      input: input.generationInput,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(essayDocuments.id, input.documentId),
        eq(essayDocuments.userId, input.userId),
      ),
    )
    .returning();
  return row ?? null;
}

/** Persist formatting input + cited generation result for an owned essay. */
export async function updateEssayDocumentCitationApplyForOwner(input: {
  documentId: number;
  userId: string;
  generationInput: EssayGenerateInput;
  result: EssayGenerationResult;
}): Promise<EssayDocumentRow | null> {
  const existing = await getEssayDocumentByIdForUser(
    input.documentId,
    input.userId,
  );
  if (!existing || existing.userId !== input.userId) return null;

  const [row] = await db
    .update(essayDocuments)
    .set({
      input: input.generationInput,
      result: input.result,
      title: input.result.title.slice(0, 512),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(essayDocuments.id, input.documentId),
        eq(essayDocuments.userId, input.userId),
      ),
    )
    .returning();
  return row ?? null;
}

/** Persist an edited generation result (and optional input) for an owned essay. */
export async function updateEssayDocumentResultForOwner(input: {
  documentId: number;
  userId: string;
  result: EssayGenerationResult;
  generationInput?: EssayGenerateInput;
}): Promise<EssayDocumentRow | null> {
  const existing = await getEssayDocumentByIdForUser(
    input.documentId,
    input.userId,
  );
  if (!existing || existing.userId !== input.userId) return null;

  const [row] = await db
    .update(essayDocuments)
    .set({
      result: input.result,
      ...(input.generationInput ? { input: input.generationInput } : {}),
      title: input.result.title.slice(0, 512),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(essayDocuments.id, input.documentId),
        eq(essayDocuments.userId, input.userId),
      ),
    )
    .returning();
  return row ?? null;
}

/** Essays the user saved from Citation & Formatting (Formatted papers tab). */
export async function listCitationFormattedEssaysForUser(
  userId: string,
): Promise<EssayDocumentRow[]> {
  const rows = await listEssayDocumentsForUser(userId);
  return rows.filter((doc) => isEssayCitationFormattedSaved(doc.input));
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

export async function countEssayFeedbackForUser(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(essayFeedback)
    .where(eq(essayFeedback.userId, userId));
  return row?.count ?? 0;
}

/** Delete every AI feedback row owned by this user (essays/drafts kept). */
export async function deleteAllEssayFeedbackForUser(
  userId: string,
): Promise<number> {
  const deleted = await db
    .delete(essayFeedback)
    .where(eq(essayFeedback.userId, userId))
    .returning({ id: essayFeedback.id });
  return deleted.length;
}

/**
 * Permanently delete every essay document owned by this user, plus related
 * drafts, feedback, and assignments for those documents.
 */
export async function deleteAllEssayDocumentsForOwner(
  userId: string,
): Promise<number> {
  const docs = await db
    .select({ id: essayDocuments.id })
    .from(essayDocuments)
    .where(eq(essayDocuments.userId, userId));
  if (docs.length === 0) return 0;

  const docIds = docs.map((d) => d.id);
  await db
    .delete(essayFeedback)
    .where(inArray(essayFeedback.documentId, docIds));
  await db
    .delete(essayAssignments)
    .where(inArray(essayAssignments.documentId, docIds));
  await db.delete(essayDrafts).where(inArray(essayDrafts.documentId, docIds));
  const deleted = await db
    .delete(essayDocuments)
    .where(eq(essayDocuments.userId, userId))
    .returning({ id: essayDocuments.id });
  return deleted.length;
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

export async function renameEssayDocumentForOwner(
  documentId: number,
  userId: string,
  title: string,
): Promise<EssayDocumentRow | null> {
  const existing = await getEssayDocumentByIdForUser(documentId, userId);
  if (!existing || existing.userId !== userId) return null;

  const nextResult = {
    ...existing.result,
    title,
  };

  const [row] = await db
    .update(essayDocuments)
    .set({
      title,
      result: nextResult,
      updatedAt: new Date(),
    })
    .where(
      and(eq(essayDocuments.id, documentId), eq(essayDocuments.userId, userId)),
    )
    .returning();
  return row ?? null;
}

/** Owner updates title + generation result (prompt, outline, objectives, etc.). */
export async function updateEssayDocumentInstructionsForOwner(input: {
  documentId: number;
  userId: string;
  title: string;
  result: EssayGenerationResult;
}): Promise<EssayDocumentRow | null> {
  const existing = await getEssayDocumentByIdForUser(
    input.documentId,
    input.userId,
  );
  if (!existing || existing.userId !== input.userId) return null;

  const [row] = await db
    .update(essayDocuments)
    .set({
      title: input.title,
      result: {
        ...input.result,
        title: input.title,
      },
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(essayDocuments.id, input.documentId),
        eq(essayDocuments.userId, input.userId),
      ),
    )
    .returning();
  return row ?? null;
}

/** Permanently delete an owned essay document and related drafts/feedback/assignments. */
export async function deleteEssayDocumentForOwner(
  documentId: number,
  userId: string,
): Promise<boolean> {
  const existing = await getEssayDocumentByIdForUser(documentId, userId);
  if (!existing || existing.userId !== userId) return false;

  await db.delete(essayFeedback).where(eq(essayFeedback.documentId, documentId));
  await db
    .delete(essayAssignments)
    .where(eq(essayAssignments.documentId, documentId));
  await db.delete(essayDrafts).where(eq(essayDrafts.documentId, documentId));
  const deleted = await db
    .delete(essayDocuments)
    .where(
      and(eq(essayDocuments.id, documentId), eq(essayDocuments.userId, userId)),
    )
    .returning({ id: essayDocuments.id });
  return deleted.length > 0;
}
