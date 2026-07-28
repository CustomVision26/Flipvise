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

export type DeckDeleteWarningCopyOptions = {
  /**
   * True when the user’s current plan can open Teacher Tools
   * (Education Plus / Gold / Enterprise). Non-Education plans use
   * prior-Education lesson-plan link wording when links still exist.
   */
  isEducationPlan: boolean;
};

/**
 * Notice shown only on non-Education plans when a deck still has linked
 * saved lesson plans from a previous Education subscription.
 */
export function buildNonEducationPriorLessonPlanNotice(
  impact: DeckDeleteImpact,
): string | null {
  if (impact.linkedLessonPlanCount <= 0) return null;

  const planWord = plural(impact.linkedLessonPlanCount, "plan");
  const countLabel =
    impact.linkedLessonPlanCount === 1
      ? "a linked lesson plan"
      : `${impact.linkedLessonPlanCount} linked lesson plans`;

  return (
    `This deck still has ${countLabel} from a previous Education plan. ` +
    `The lesson plan link under that previous Education workspace / Teacher Tools will be lost. ` +
    `If you return to an Education plan later, you will only see the saved lesson ${planWord} in the Resource Library — the link to this deck will not be available (Edit and Create Quiz will not work for ${impact.linkedLessonPlanCount === 1 ? "that plan" : "those plans"}).`
  );
}

/**
 * Rows that survive delete but lose a usable deck link (set-null or orphaned deckId).
 */
export function buildDeckDeleteBrokenLinkItems(
  impact: DeckDeleteImpact,
  options: DeckDeleteWarningCopyOptions,
): string[] {
  const items: string[] = [];

  if (impact.linkedLessonPlanCount > 0) {
    const keeping = impact.linkedLessonPlansKeepingEditCreateCount;
    const losing = impact.linkedLessonPlansLosingEditCreateCount;

    if (options.isEducationPlan) {
      if (keeping > 0) {
        items.push(
          `Linked lesson ${plural(keeping, "plan")} (${keeping}) stay in the Resource Library with Edit and Create Quiz still available (another related deck remains linked)`,
        );
      }
      if (losing > 0) {
        items.push(
          `Linked lesson ${plural(losing, "plan")} (${losing}) stay in the Resource Library, but Edit and Create Quiz become unavailable (this is the last linked deck)`,
        );
      }
    } else {
      items.push(
        `Saved lesson ${plural(impact.linkedLessonPlanCount, "plan")} (${impact.linkedLessonPlanCount}) may remain in the Resource Library after you return to Education, but without a working link to this deck`,
      );
    }
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
