/** Free tier: max cards of any kind per deck */
export const CARDS_PER_DECK_LIMIT_FREE = 8;

/** Pro tier with 75_cards_per_deck feature: max cards of any kind per deck */
export const CARDS_PER_DECK_LIMIT_PRO = 75;

/** Pro / paid: max AI-generated cards tracked per deck (batch sizes are capped here too) */
export const AI_GENERATION_CAP_PER_DECK = 75;

/**
 * Returns the cards per deck limit based on the user's plan.
 * @param has75CardsPerDeck - Whether the user has the 75_cards_per_deck feature
 */
export function getCardsPerDeckLimit(has75CardsPerDeck: boolean): number {
  return has75CardsPerDeck ? CARDS_PER_DECK_LIMIT_PRO : CARDS_PER_DECK_LIMIT_FREE;
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
