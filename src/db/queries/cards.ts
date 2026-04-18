import { db } from "@/db";
import { cards, decks } from "@/db/schema";
import { and, desc, eq, getTableColumns } from "drizzle-orm";

/**
 * Lists every card in a deck, enforcing ownership at the query level by
 * joining `decks` and requiring `decks.userId = userId`. This means callers
 * cannot accidentally leak another user's cards even if they forget to
 * call `getDeckById` first.
 */
export async function getCardsByDeck(deckId: number, userId: string) {
  return db
    .select(getTableColumns(cards))
    .from(cards)
    .innerJoin(decks, eq(cards.deckId, decks.id))
    .where(and(eq(cards.deckId, deckId), eq(decks.userId, userId)))
    .orderBy(desc(cards.updatedAt));
}

export async function createCard(
  deckId: number,
  front: string | null,
  frontImageUrl: string | null,
  back: string | null,
  backImageUrl: string | null,
  aiGenerated = false,
  choices: string[] | null = null,
  correctChoiceIndex: number | null = null,
) {
  const [inserted] = await db
    .insert(cards)
    .values({
      deckId,
      front,
      frontImageUrl,
      back,
      backImageUrl,
      aiGenerated,
      choices,
      correctChoiceIndex,
    })
    .returning({ id: cards.id });
  return inserted;
}

/**
 * Update only the `choices` + `correctChoiceIndex` on a card. Used for
 * back-filling AI-generated distractors onto a standard card after it has
 * already been created (so the user doesn't have to wait for AI).
 */
export async function updateCardChoices(
  cardId: number,
  deckId: number,
  choices: string[],
  correctChoiceIndex: number,
) {
  return db
    .update(cards)
    .set({ choices, correctChoiceIndex, updatedAt: new Date() })
    .where(and(eq(cards.id, cardId), eq(cards.deckId, deckId)));
}

export async function updateCard(
  cardId: number,
  deckId: number,
  front: string | null,
  frontImageUrl: string | null,
  back: string | null,
  backImageUrl: string | null,
) {
  return db
    .update(cards)
    .set({ front, frontImageUrl, back, backImageUrl, updatedAt: new Date() })
    .where(and(eq(cards.id, cardId), eq(cards.deckId, deckId)));
}

export async function getCardById(cardId: number, deckId: number) {
  const result = await db
    .select()
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.deckId, deckId)));
  return result[0] ?? null;
}

export async function deleteCard(cardId: number, deckId: number) {
  return db
    .delete(cards)
    .where(and(eq(cards.id, cardId), eq(cards.deckId, deckId)));
}

export async function bulkCreateCards(
  deckId: number,
  cardList: { front: string; back: string; distractors?: string[] | null }[],
  aiGenerated: boolean,
) {
  return db.insert(cards).values(
    cardList.map((c) => {
      const hasDistractors = Array.isArray(c.distractors) && c.distractors.length === 3;
      return {
        deckId,
        front: c.front,
        frontImageUrl: null,
        back: c.back,
        backImageUrl: null,
        aiGenerated,
        choices: hasDistractors ? [c.back, ...(c.distractors as string[])] : null,
        correctChoiceIndex: hasDistractors ? 0 : null,
      };
    }),
  );
}

export async function deleteAllCards(deckId: number) {
  return db.delete(cards).where(eq(cards.deckId, deckId));
}

export async function createMultipleChoiceCard(
  deckId: number,
  question: string,
  questionImageUrl: string | null,
  choices: string[],
  correctChoiceIndex: number,
  aiGenerated = false,
) {
  return db.insert(cards).values({
    deckId,
    front: question,
    frontImageUrl: questionImageUrl,
    back: choices[correctChoiceIndex] ?? null,
    backImageUrl: null,
    cardType: 'multiple_choice',
    choices,
    correctChoiceIndex,
    aiGenerated,
  });
}

export async function updateMultipleChoiceCard(
  cardId: number,
  deckId: number,
  question: string,
  questionImageUrl: string | null,
  choices: string[],
  correctChoiceIndex: number,
) {
  return db
    .update(cards)
    .set({
      front: question,
      frontImageUrl: questionImageUrl,
      back: choices[correctChoiceIndex] ?? null,
      backImageUrl: null,
      choices,
      correctChoiceIndex,
      updatedAt: new Date(),
    })
    .where(and(eq(cards.id, cardId), eq(cards.deckId, deckId)));
}
