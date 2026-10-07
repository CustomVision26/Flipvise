export type EducationWorkspaceDeckRef = {
  createdByUserId?: string | null;
  description?: string | null;
};

/** Education Gold / Enterprise — deck row was created by an invited team admin. */
export function isTeamAdminCreatedEducationDeck(
  deck: EducationWorkspaceDeckRef,
  ownerUserId: string,
): boolean {
  const creator = deck.createdByUserId?.trim();
  if (!creator) return false;
  return creator !== ownerUserId;
}

/** Owner-created workspace deck tied to a lesson plan (source plan or a quiz saved from one). */
export function isOwnerLessonPlanWorkspaceDeck(
  deck: EducationWorkspaceDeckRef,
  ownerUserId: string,
): boolean {
  if (isTeamAdminCreatedEducationDeck(deck, ownerUserId)) return false;
  const description = deck.description ?? "";
  return (
    /teacher lesson plan deck/i.test(description) ||
    /lesson plan #\d+/i.test(description)
  );
}

export function partitionEducationOwnerWorkspaceDecks<
  T extends EducationWorkspaceDeckRef,
>(
  decks: readonly T[],
  ownerUserId: string,
): { teamAdmin: T[]; ownerLessonPlans: T[]; otherOwner: T[] } {
  const teamAdmin: T[] = [];
  const ownerLessonPlans: T[] = [];
  const otherOwner: T[] = [];

  for (const deck of decks) {
    if (isTeamAdminCreatedEducationDeck(deck, ownerUserId)) {
      teamAdmin.push(deck);
    } else if (isOwnerLessonPlanWorkspaceDeck(deck, ownerUserId)) {
      ownerLessonPlans.push(deck);
    } else {
      otherOwner.push(deck);
    }
  }

  return { teamAdmin, ownerLessonPlans, otherOwner };
}
