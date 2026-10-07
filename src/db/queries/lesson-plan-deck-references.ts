import { db } from "@/db";
import { decks, savedLessonPlans } from "@/db/schema";
import { getDeckRowById } from "@/db/queries/decks";
import {
  getPrimaryLinkedLessonPlanForDeck,
  resolveSavedLessonPlanForViewer,
  type SavedLessonPlanRow,
} from "@/db/queries/saved-lesson-plans";
import { parseDeckSubjectTopic } from "@/lib/deck-subject-topic";
import { parseLessonPlanIdFromDeckDescription } from "@/lib/lesson-plan-deck-marker";
import {
  getLessonPlanReferenceMaterials,
  MAX_LESSON_PLAN_REFERENCES,
  normalizeLessonPlanReferenceMaterial,
  type LessonPlanReferenceMaterial,
} from "@/lib/lesson-plan-reference-material";
import { stripLessonPlanScopedDeckSuffix } from "@/lib/teacher-generation-titles";
import { and, desc, eq, isNull, ne } from "drizzle-orm";

function referencesFromPlan(
  plan: Pick<SavedLessonPlanRow, "input"> | null | undefined,
): LessonPlanReferenceMaterial[] {
  return getLessonPlanReferenceMaterials(plan?.input)
    .map(normalizeLessonPlanReferenceMaterial)
    .slice(0, MAX_LESSON_PLAN_REFERENCES);
}

async function getLatestPlanBySourceDeckNameForUser(
  userId: string,
  sourceDeckName: string,
): Promise<SavedLessonPlanRow | null> {
  const name = sourceDeckName.trim();
  if (!name) return null;
  const [row] = await db
    .select()
    .from(savedLessonPlans)
    .where(
      and(
        eq(savedLessonPlans.userId, userId),
        eq(savedLessonPlans.sourceDeckName, name),
      ),
    )
    .orderBy(desc(savedLessonPlans.createdAt))
    .limit(1);
  return row ?? null;
}

async function getLatestPlanBySubjectTopicForUser(
  userId: string,
  subject: string,
  topic: string,
): Promise<SavedLessonPlanRow | null> {
  const [row] = await db
    .select()
    .from(savedLessonPlans)
    .where(
      and(
        eq(savedLessonPlans.userId, userId),
        eq(savedLessonPlans.subject, subject),
        eq(savedLessonPlans.topic, topic),
      ),
    )
    .orderBy(desc(savedLessonPlans.createdAt))
    .limit(1);
  return row ?? null;
}

async function findDeckIdByExactNameForOwner(params: {
  ownerUserId: string;
  teamId: number | null;
  name: string;
  excludeDeckId: number;
}): Promise<number | null> {
  const name = params.name.trim();
  if (!name) return null;
  const ownership =
    params.teamId != null
      ? and(eq(decks.userId, params.ownerUserId), eq(decks.teamId, params.teamId))
      : and(eq(decks.userId, params.ownerUserId), isNull(decks.teamId));
  const [row] = await db
    .select({ id: decks.id })
    .from(decks)
    .where(
      and(
        ownership,
        eq(decks.name, name),
        ne(decks.id, params.excludeDeckId),
        isNull(decks.inactiveAt),
      ),
    )
    .orderBy(desc(decks.updatedAt))
    .limit(1);
  return row?.id ?? null;
}

async function visiblePlanForViewer(
  viewerUserId: string,
  plan: SavedLessonPlanRow | null,
  teamId?: number | null,
): Promise<SavedLessonPlanRow | null> {
  if (!plan) return null;
  if (plan.userId === viewerUserId) return plan;
  return resolveSavedLessonPlanForViewer(viewerUserId, plan.id, teamId);
}

/**
 * Reference material from a lesson plan related to this deck: a direct link,
 * a `Lesson plan #id` quiz-deck tag, the parent `LP Day N` deck, or matching
 * subject/topic.
 */
export async function getLessonPlanReferenceMaterialsForDeckSource(
  viewerUserId: string,
  deckId: number,
  teamId?: number | null,
): Promise<LessonPlanReferenceMaterial[]> {
  const deck = await getDeckRowById(deckId);
  if (!deck) return [];

  const workspaceTeamId = teamId ?? deck.teamId;

  const linked = await getPrimaryLinkedLessonPlanForDeck(deckId, viewerUserId);
  const linkedVisible = await visiblePlanForViewer(
    viewerUserId,
    linked,
    workspaceTeamId,
  );
  const linkedRefs = referencesFromPlan(linkedVisible);
  if (linkedRefs.length > 0) return linkedRefs;

  const taggedId = parseLessonPlanIdFromDeckDescription(deck.description);
  if (taggedId) {
    const tagged = await resolveSavedLessonPlanForViewer(
      viewerUserId,
      taggedId,
      workspaceTeamId,
    );
    const taggedRefs = referencesFromPlan(tagged);
    if (taggedRefs.length > 0) return taggedRefs;
  }

  const parentName = stripLessonPlanScopedDeckSuffix(deck.name);
  if (parentName) {
    const bySourceName = await getLatestPlanBySourceDeckNameForUser(
      viewerUserId,
      parentName,
    );
    const sourceRefs = referencesFromPlan(bySourceName);
    if (sourceRefs.length > 0) return sourceRefs;

    if (deck.userId !== viewerUserId) {
      const ownerByName = await getLatestPlanBySourceDeckNameForUser(
        deck.userId,
        parentName,
      );
      const ownerVisible = await visiblePlanForViewer(
        viewerUserId,
        ownerByName,
        workspaceTeamId,
      );
      const ownerRefs = referencesFromPlan(ownerVisible);
      if (ownerRefs.length > 0) return ownerRefs;
    }

    const parentDeckId = await findDeckIdByExactNameForOwner({
      ownerUserId: deck.userId,
      teamId: deck.teamId,
      name: parentName,
      excludeDeckId: deck.id,
    });
    if (parentDeckId != null) {
      const parentPlan = await getPrimaryLinkedLessonPlanForDeck(
        parentDeckId,
        viewerUserId,
      );
      const parentVisible = await visiblePlanForViewer(
        viewerUserId,
        parentPlan,
        workspaceTeamId,
      );
      const parentRefs = referencesFromPlan(parentVisible);
      if (parentRefs.length > 0) return parentRefs;
    }
  }

  const { subject, topic } = parseDeckSubjectTopic(deck);
  if (subject && topic) {
    const byFields = await getLatestPlanBySubjectTopicForUser(
      viewerUserId,
      subject,
      topic,
    );
    const fieldRefs = referencesFromPlan(byFields);
    if (fieldRefs.length > 0) return fieldRefs;

    if (deck.userId !== viewerUserId) {
      const ownerByFields = await getLatestPlanBySubjectTopicForUser(
        deck.userId,
        subject,
        topic,
      );
      const ownerVisible = await visiblePlanForViewer(
        viewerUserId,
        ownerByFields,
        workspaceTeamId,
      );
      const ownerFieldRefs = referencesFromPlan(ownerVisible);
      if (ownerFieldRefs.length > 0) return ownerFieldRefs;
    }
  }

  return [];
}
