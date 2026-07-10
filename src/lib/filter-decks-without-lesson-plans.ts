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

  const itemsByAdminUserId: Record<string, DeckRow[]> = {};
  for (const [adminUserId, adminDecks] of Object.entries(
    picker.itemsByAdminUserId,
  )) {
    const usedForAdmin =
      deckUsage.usedDeckIdsByUserId.get(adminUserId) ?? new Set<number>();
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
