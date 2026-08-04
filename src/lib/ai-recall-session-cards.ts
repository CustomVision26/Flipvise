/**
 * Pure helpers for AI Recall™ session card limits.
 * Kept out of DB query modules so study pages do not pull heavy query graphs.
 */

/** Null = all cards in the deck. */
export const AI_RECALL_SESSION_CARD_COUNT_MIN = 1;
export const AI_RECALL_SESSION_CARD_COUNT_MAX = 100;
/** Deck-level sentinel: all cards (overrides a fixed workspace count). */
export const AI_RECALL_SESSION_CARD_COUNT_ALL = 0;

export function clampAiRecallSessionCardCount(
  value: number | null | undefined,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const n = Math.floor(value);
  if (n < AI_RECALL_SESSION_CARD_COUNT_MIN) return null;
  return Math.min(AI_RECALL_SESSION_CARD_COUNT_MAX, n);
}

/**
 * Resolve effective AI Recall session size.
 * - Workspace: null = all cards; 1–100 = fixed.
 * - Deck: null = inherit workspace; 0 = all cards; 1–100 = fixed.
 * Returns null when the session should use every card in the deck.
 */
export function resolveEffectiveAiRecallSessionCardCount(input: {
  deckCardCount: number | null | undefined;
  workspaceCardCount: number | null | undefined;
}): number | null {
  const deckRaw = input.deckCardCount;
  if (deckRaw != null && Number.isFinite(deckRaw)) {
    const deck = Math.floor(deckRaw);
    if (deck === AI_RECALL_SESSION_CARD_COUNT_ALL) return null;
    return clampAiRecallSessionCardCount(deck);
  }
  return clampAiRecallSessionCardCount(input.workspaceCardCount);
}

export type AiRecallSessionCardDeckSnapshot = {
  id: number;
  name: string;
  /** null = inherit workspace; 0 = all cards; 1–100 = fixed. */
  aiRecallSessionCardCount: number | null;
};
