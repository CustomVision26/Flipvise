import {
  FREE_CARDS_PER_DECK_LIMIT,
  PRO_CARDS_PER_DECK_LIMIT,
  PRO_PLUS_CARDS_PER_DECK_LIMIT,
} from "@/lib/personal-plan-limits";

/** Free tier: max cards of any kind per deck */
export const CARDS_PER_DECK_LIMIT_FREE = FREE_CARDS_PER_DECK_LIMIT;

/** Highest paid tier card cap (Pro Plus and team-tier workspaces). */
export const CARDS_PER_DECK_LIMIT_PRO_PLUS = PRO_PLUS_CARDS_PER_DECK_LIMIT;

/** Pro individual tier card cap */
export const CARDS_PER_DECK_LIMIT_PRO_INDIVIDUAL = PRO_CARDS_PER_DECK_LIMIT;

/** Pro / paid: max AI-generated cards tracked per deck (batch sizes are capped here too) */
export const AI_GENERATION_CAP_PER_DECK = PRO_PLUS_CARDS_PER_DECK_LIMIT;

/** Single deck editor/study: cap follows team workspace tier when viewing a team-tier deck. */
export function resolveDeckCardCap(input: {
  teamTierProWorkspace: boolean;
  personalMaxCardsPerDeck: number;
}): number {
  if (input.teamTierProWorkspace) return PRO_PLUS_CARDS_PER_DECK_LIMIT;
  return input.personalMaxCardsPerDeck;
}

export const AI_BATCH_MAX = PRO_PLUS_CARDS_PER_DECK_LIMIT;

export const AI_BATCH_STEP = 5;

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
