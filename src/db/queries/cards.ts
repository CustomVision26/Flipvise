import { db } from "@/db";
import { cards } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export async function getCardsByDeck(deckId: number) {
  return db
    .select()
    .from(cards)
    .where(eq(cards.deckId, deckId))
    .orderBy(desc(cards.updatedAt));
}

export async function createCard(
  deckId: number,
  front: string | null,
  frontImageUrl: string | null,
  back: string | null,
  backImageUrl: string | null,
  aiGenerated = false,
) {
  return db.insert(cards).values({
    deckId,
    front,
    frontImageUrl,
    back,
    backImageUrl,
    aiGenerated,
  });
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
  cardList: { front: string; back: string }[],
  aiGenerated: boolean,
) {
  return db.insert(cards).values(
    cardList.map((c) => ({
      deckId,
      front: c.front,
      frontImageUrl: null,
      back: c.back,
      backImageUrl: null,
      aiGenerated,
    })),
  );
}

export async function deleteAllCards(deckId: number) {
  return db.delete(cards).where(eq(cards.deckId, deckId));
}
