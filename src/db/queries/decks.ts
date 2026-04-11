import { db } from "@/db";
import { decks, cards } from "@/db/schema";
import { and, eq, count } from "drizzle-orm";

export async function getDecksByUser(userId: string) {
  return db.select().from(decks).where(eq(decks.userId, userId));
}

export async function getDecksByUserWithCardCount(userId: string) {
  return db
    .select({
      id: decks.id,
      userId: decks.userId,
      name: decks.name,
      description: decks.description,
      createdAt: decks.createdAt,
      updatedAt: decks.updatedAt,
      cardCount: count(cards.id),
    })
    .from(decks)
    .leftJoin(cards, eq(cards.deckId, decks.id))
    .where(eq(decks.userId, userId))
    .groupBy(
      decks.id,
      decks.userId,
      decks.name,
      decks.description,
      decks.createdAt,
      decks.updatedAt,
    );
}

export async function getDeckById(deckId: number, userId: string) {
  const rows = await db
    .select()
    .from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId)));
  return rows[0] ?? null;
}

export async function createDeck(
  userId: string,
  name: string,
  description?: string,
) {
  return db.insert(decks).values({ userId, name, description });
}

export async function updateDeck(
  deckId: number,
  userId: string,
  name: string,
  description?: string,
) {
  return db
    .update(decks)
    .set({ name, description, updatedAt: new Date() })
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId)));
}

export async function deleteDeck(deckId: number, userId: string) {
  return db
    .delete(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId)));
}
