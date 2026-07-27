import "server-only";

import { db } from "@/db";
import {
  aiRecallSessions,
  cardMastery,
  cards,
  deckWorkspaceLinks,
  decks,
  quizCardOrders,
  quizResults,
  savedHomeworkAssignments,
  savedLessonPlans,
  savedWorksheets,
  teacherClasses,
  teamDeckAssignments,
} from "@/db/schema";
import { and, count, eq, isNotNull, or } from "drizzle-orm";

/** Snapshot of what deleting a deck will remove or break (schema-accurate). */
export type DeckDeleteImpact = {
  deckName: string;
  cardCount: number;
  hasCoverImage: boolean;
  hasCardImages: boolean;
  teamAssignmentCount: number;
  workspaceLinkCount: number;
  linkedLessonPlanCount: number;
  linkedHomeworkCount: number;
  linkedWorksheetCount: number;
  teacherClassCount: number;
  cardMasteryCount: number;
  quizCardOrderCount: number;
  quizResultCount: number;
  aiRecallSessionCount: number;
};

/**
 * Collect cascade / orphan impact for a deck before delete.
 * Ownership is enforced by the caller (delete action / viewer access).
 */
export async function getDeckDeleteImpact(
  deckId: number,
): Promise<DeckDeleteImpact | null> {
  const [deck] = await db
    .select({
      id: decks.id,
      name: decks.name,
      coverImageUrl: decks.coverImageUrl,
    })
    .from(decks)
    .where(eq(decks.id, deckId))
    .limit(1);

  if (!deck) return null;

  const [
    cardCountRows,
    cardImageRows,
    assignmentRows,
    workspaceLinkRows,
    lessonPlanRows,
    homeworkRows,
    worksheetRows,
    teacherClassRows,
    masteryRows,
    quizOrderRows,
    quizResultRows,
    aiRecallRows,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(cards)
      .where(eq(cards.deckId, deckId)),
    db
      .select({ value: count() })
      .from(cards)
      .where(
        and(
          eq(cards.deckId, deckId),
          or(isNotNull(cards.frontImageUrl), isNotNull(cards.backImageUrl)),
        ),
      ),
    db
      .select({ value: count() })
      .from(teamDeckAssignments)
      .where(eq(teamDeckAssignments.deckId, deckId)),
    db
      .select({ value: count() })
      .from(deckWorkspaceLinks)
      .where(eq(deckWorkspaceLinks.deckId, deckId)),
    db
      .select({ value: count() })
      .from(savedLessonPlans)
      .where(eq(savedLessonPlans.deckId, deckId)),
    db
      .select({ value: count() })
      .from(savedHomeworkAssignments)
      .where(eq(savedHomeworkAssignments.deckId, deckId)),
    db
      .select({ value: count() })
      .from(savedWorksheets)
      .where(eq(savedWorksheets.deckId, deckId)),
    db
      .select({ value: count() })
      .from(teacherClasses)
      .where(eq(teacherClasses.deckId, deckId)),
    db
      .select({ value: count() })
      .from(cardMastery)
      .where(eq(cardMastery.deckId, deckId)),
    db
      .select({ value: count() })
      .from(quizCardOrders)
      .where(eq(quizCardOrders.deckId, deckId)),
    db
      .select({ value: count() })
      .from(quizResults)
      .where(eq(quizResults.deckId, deckId)),
    db
      .select({ value: count() })
      .from(aiRecallSessions)
      .where(eq(aiRecallSessions.deckId, deckId)),
  ]);

  return {
    deckName: deck.name,
    cardCount: Number(cardCountRows[0]?.value ?? 0),
    hasCoverImage: Boolean(deck.coverImageUrl),
    hasCardImages: Number(cardImageRows[0]?.value ?? 0) > 0,
    teamAssignmentCount: Number(assignmentRows[0]?.value ?? 0),
    workspaceLinkCount: Number(workspaceLinkRows[0]?.value ?? 0),
    linkedLessonPlanCount: Number(lessonPlanRows[0]?.value ?? 0),
    linkedHomeworkCount: Number(homeworkRows[0]?.value ?? 0),
    linkedWorksheetCount: Number(worksheetRows[0]?.value ?? 0),
    teacherClassCount: Number(teacherClassRows[0]?.value ?? 0),
    cardMasteryCount: Number(masteryRows[0]?.value ?? 0),
    quizCardOrderCount: Number(quizOrderRows[0]?.value ?? 0),
    quizResultCount: Number(quizResultRows[0]?.value ?? 0),
    aiRecallSessionCount: Number(aiRecallRows[0]?.value ?? 0),
  };
}

/** True when delete has Education / team side effects beyond a plain personal deck. */
export function deckDeleteImpactNeedsDetailedWarning(
  impact: DeckDeleteImpact,
): boolean {
  return (
    impact.teamAssignmentCount > 0 ||
    impact.workspaceLinkCount > 0 ||
    impact.linkedLessonPlanCount > 0 ||
    impact.linkedHomeworkCount > 0 ||
    impact.linkedWorksheetCount > 0 ||
    impact.teacherClassCount > 0 ||
    impact.cardMasteryCount > 0 ||
    impact.quizCardOrderCount > 0 ||
    impact.quizResultCount > 0 ||
    impact.aiRecallSessionCount > 0
  );
}
