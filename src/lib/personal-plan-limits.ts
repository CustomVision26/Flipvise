/** Personal workspace (non-team-deck) numeric caps — enforced server-side in actions. */

export const FREE_PERSONAL_DECK_LIMIT = 2;
export const FREE_CARDS_PER_DECK_LIMIT = 5;

export const PRO_PERSONAL_DECK_LIMIT = 10;
export const PRO_CARDS_PER_DECK_LIMIT = 30;

export const PRO_PLUS_PERSONAL_DECK_LIMIT = 15;
export const PRO_PLUS_CARDS_PER_DECK_LIMIT = 52;

/** Paid individual tiers only (team-tier personal workspace uses Pro Plus caps). */
export type PersonalIndividualPaidTier = "pro" | "pro_plus";

export type PersonalWorkspaceLimits = {
  maxPersonalDecks: number;
  maxCardsPerDeck: number;
};

export function limitsForPersonalIndividualTier(
  tier: PersonalIndividualPaidTier,
): PersonalWorkspaceLimits {
  return tier === "pro_plus"
    ? {
        maxPersonalDecks: PRO_PLUS_PERSONAL_DECK_LIMIT,
        maxCardsPerDeck: PRO_PLUS_CARDS_PER_DECK_LIMIT,
      }
    : {
        maxPersonalDecks: PRO_PERSONAL_DECK_LIMIT,
        maxCardsPerDeck: PRO_CARDS_PER_DECK_LIMIT,
      };
}

export function proPlusPersonalLimits(): PersonalWorkspaceLimits {
  return limitsForPersonalIndividualTier("pro_plus");
}
