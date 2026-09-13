/** Back text used when Create Deck stored a cover image as a fake flashcard. */
export const COVER_PLACEHOLDER_BACK = "Add the answer on this side";

export function isCoverPlaceholderCard(card: {
  front?: string | null;
  back?: string | null;
  frontImageUrl?: string | null;
  backImageUrl?: string | null;
  aiGenerated?: boolean | null;
}): boolean {
  if (card.aiGenerated) return false;
  if (!card.frontImageUrl?.trim()) return false;
  if (card.backImageUrl?.trim()) return false;
  if (card.front?.trim()) return false;
  const back = card.back?.trim() ?? "";
  return back === "" || back === COVER_PLACEHOLDER_BACK;
}
