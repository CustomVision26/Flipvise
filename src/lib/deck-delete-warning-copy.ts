import type { DeckDeleteImpact } from "@/db/queries/deck-delete-impact";

function plural(count: number, singular: string, pluralForm?: string): string {
  return count === 1 ? singular : (pluralForm ?? `${singular}s`);
}

/** Permanently removed rows / assets when a deck is deleted. */
export function buildDeckDeletePermanentLossItems(
  impact: DeckDeleteImpact,
): string[] {
  const items: string[] = [
    `The deck and all of its flashcards (${impact.cardCount} ${plural(impact.cardCount, "card")})`,
  ];

  if (impact.hasCoverImage || impact.hasCardImages) {
    items.push("Cover and card images for this deck");
  }

  if (impact.teamAssignmentCount > 0) {
    items.push(
      `Team deck assignments (${impact.teamAssignmentCount} ${plural(impact.teamAssignmentCount, "member")} will lose access to this deck)`,
    );
  }

  if (impact.workspaceLinkCount > 0) {
    items.push(
      `Workspace links for this deck (${impact.workspaceLinkCount} ${plural(impact.workspaceLinkCount, "workspace")})`,
    );
  }

  if (impact.teacherClassCount > 0) {
    items.push(
      `Teacher classes linked to this deck (${impact.teacherClassCount} ${plural(impact.teacherClassCount, "class", "classes")})`,
    );
  }

  if (impact.cardMasteryCount > 0) {
    items.push("AI Recall™ mastery progress for cards in this deck");
  }

  if (impact.quizCardOrderCount > 0) {
    items.push("Quiz card order settings for this deck");
  }

  return items;
}

/**
 * Rows that survive delete but lose a usable deck link (set-null or orphaned deckId).
 */
export function buildDeckDeleteBrokenLinkItems(
  impact: DeckDeleteImpact,
): string[] {
  const items: string[] = [];

  if (impact.linkedLessonPlanCount > 0) {
    items.push(
      `Linked lesson ${plural(impact.linkedLessonPlanCount, "plan")} (${impact.linkedLessonPlanCount}) stay in the Resource Library, but Edit and Create Quiz become unavailable`,
    );
  }

  if (impact.linkedHomeworkCount > 0) {
    items.push(
      `Saved homework that referenced this deck (${impact.linkedHomeworkCount}) keeps its copy, but the deck link is broken`,
    );
  }

  if (impact.linkedWorksheetCount > 0) {
    items.push(
      `Saved worksheets that referenced this deck (${impact.linkedWorksheetCount}) keep their copies, but the deck link is broken`,
    );
  }

  if (impact.quizResultCount > 0) {
    items.push(
      `Saved quiz results (${impact.quizResultCount}) remain as history but are no longer linked to this deck`,
    );
  }

  if (impact.aiRecallSessionCount > 0) {
    items.push(
      `AI Recall™ session history (${impact.aiRecallSessionCount}) remains but is no longer linked to this deck`,
    );
  }

  return items;
}
