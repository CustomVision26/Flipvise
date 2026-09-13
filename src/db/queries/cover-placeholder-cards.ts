import { and, eq, sql } from "drizzle-orm";
import { cards, decks } from "@/db/schema";
import { COVER_PLACEHOLDER_BACK } from "@/lib/cover-placeholder-card";

/** SQL: true when the row is a cover image stored as a fake flashcard. */
export const coverPlaceholderCardSql = sql`
  coalesce(btrim(${cards.front}), '') = ''
  AND ${cards.frontImageUrl} IS NOT NULL
  AND ${cards.backImageUrl} IS NULL
  AND coalesce(${cards.aiGenerated}, false) = false
  AND (
    coalesce(btrim(${cards.back}), '') = ''
    OR btrim(${cards.back}) = ${COVER_PLACEHOLDER_BACK}
  )
`;

/** Left-join flashcards that count toward deck limits and study. */
export function studyCardsLeftJoinOnDeck() {
  return and(eq(cards.deckId, decks.id), sql`NOT (${coverPlaceholderCardSql})`);
}
