/** Free tier: max cards of any kind per deck */
export const CARDS_PER_DECK_LIMIT_FREE = 15;

/** Pro tier: max cards of any kind per deck */
export const CARDS_PER_DECK_LIMIT_PRO = 75;

/** Pro / paid: max AI-generated cards tracked per deck (batch sizes are capped here too) */
export const AI_GENERATION_CAP_PER_DECK = 75;

export function getCardsPerDeckLimit(hasUnlimitedDecks: boolean): number {
  return hasUnlimitedDecks ? CARDS_PER_DECK_LIMIT_PRO : CARDS_PER_DECK_LIMIT_FREE;
}

export const AI_BATCH_STEP = 5;
export const AI_BATCH_MAX = 75;

/**
 * Multiples of {@link AI_BATCH_STEP} from step through min(cap, remaining AI slots, remaining deck slots).
 */
export function buildAiBatchOptions(
  remainingAiSlots: number,
  /** How many more cards fit in this deck for the user’s plan */
  remainingDeckSlots: number,
): number[] {
  const deckCap = Math.min(AI_BATCH_MAX, Math.max(0, remainingDeckSlots));
  const maxBatch =
    Math.floor(Math.min(remainingAiSlots, deckCap) / AI_BATCH_STEP) * AI_BATCH_STEP;
  const sizes: number[] = [];
  for (let n = AI_BATCH_STEP; n <= maxBatch; n += AI_BATCH_STEP) {
    sizes.push(n);
  }
  return sizes;
}
