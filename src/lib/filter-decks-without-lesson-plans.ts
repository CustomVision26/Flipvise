import type { DeckRow } from "@/db/queries/decks";
import type { LessonPlanDeckUsage } from "@/db/queries/saved-lesson-plans";
import type { OwnerTeamAdminDeckPickerPayload } from "@/db/queries/teacher-owner-pickers";

export function filterDecksWithoutLessonPlans(
  decks: DeckRow[],
  deckIdsWithLessonPlans: Set<number>,
  keepDeckId?: number,
): DeckRow[] {
  return decks.filter(
    (deck) =>
      !deckIdsWithLessonPlans.has(deck.id) || deck.id === keepDeckId,
  );
}

export function filterOwnerDeckPickerWithoutLessonPlans(
  picker: OwnerTeamAdminDeckPickerPayload,
  deckUsage: LessonPlanDeckUsage,
  keepDeckId?: number,
): OwnerTeamAdminDeckPickerPayload {
  if (!picker.isWorkspaceOwner) {
    return picker;
  }

  const ownerUserId = picker.teamAdmins.find(
    (admin) => admin.isWorkspaceOwner,
  )?.userId;

  const itemsByAdminUserId: Record<string, DeckRow[]> = {};
  for (const [adminUserId, adminDecks] of Object.entries(
    picker.itemsByAdminUserId,
  )) {
    // A team admin's decks stay listed after the owner saves a lesson from them.
    // That save creates the owner's own lesson-plan deck and leaves this deck in place.
    if (ownerUserId && adminUserId !== ownerUserId) {
      itemsByAdminUserId[adminUserId] = adminDecks;
      continue;
    }

    const perUser =
      deckUsage.usedDeckIdsByUserId.get(adminUserId) ?? new Set<number>();
    const usedForAdmin = new Set([...perUser, ...deckUsage.usedDeckIds]);
    itemsByAdminUserId[adminUserId] = filterDecksWithoutLessonPlans(
      adminDecks,
      usedForAdmin,
      keepDeckId,
    );
  }

  return {
    ...picker,
    itemsByAdminUserId,
  };
}
