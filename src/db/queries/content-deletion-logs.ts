import { db } from "@/db";
import { cards, contentDeletionLogs, decks } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export type ContentDeletionRecord = {
  id: number;
  kind: "deck" | "card";
  deckName: string;
  cardCount: number | null;
  cardLabel: string | null;
  deletedAt: string;
};

function clip(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}

async function insertLog(values: {
  ownerUserId: string;
  kind: "deck" | "card";
  deckName: string;
  cardCount: number | null;
  cardLabel: string | null;
}) {
  try {
    await db.insert(contentDeletionLogs).values(values);
  } catch (error) {
    console.error("[content-deletion-logs] insert:", error);
  }
}

/** Snapshot a deck, including a short list of its cards, before the row is removed. */
export async function recordDeckDeletion(deckId: number, ownerUserId: string) {
  try {
    const [deck] = await db
      .select({ name: decks.name })
      .from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.userId, ownerUserId)))
      .limit(1);
    if (!deck) return;
    const cardRows = await db
      .select({ front: cards.front, back: cards.back })
      .from(cards)
      .where(eq(cards.deckId, deckId));
    const preview = cardRows
      .map((card) => clip(card.front) ?? clip(card.back))
      .filter((label): label is string => Boolean(label))
      .slice(0, 8);
    await insertLog({
      ownerUserId,
      kind: "deck",
      deckName: deck.name,
      cardCount: cardRows.length,
      cardLabel: preview.length > 0 ? preview.join("; ") : null,
    });
  } catch (error) {
    console.error("[content-deletion-logs] deck:", error);
  }
}

/** Snapshot one card before it is removed. */
export async function recordCardDeletion(cardId: number, deckId: number) {
  try {
    const [row] = await db
      .select({
        front: cards.front,
        back: cards.back,
        deckName: decks.name,
        ownerUserId: decks.userId,
      })
      .from(cards)
      .innerJoin(decks, eq(decks.id, cards.deckId))
      .where(and(eq(cards.id, cardId), eq(cards.deckId, deckId)))
      .limit(1);
    if (!row) return;
    await insertLog({
      ownerUserId: row.ownerUserId,
      kind: "card",
      deckName: row.deckName,
      cardCount: 1,
      cardLabel: clip(row.front) ?? clip(row.back),
    });
  } catch (error) {
    console.error("[content-deletion-logs] card:", error);
  }
}

export async function listContentDeletionsForUser(
  ownerUserId: string,
): Promise<ContentDeletionRecord[]> {
  try {
    const rows = await db
      .select()
      .from(contentDeletionLogs)
      .where(eq(contentDeletionLogs.ownerUserId, ownerUserId))
      .orderBy(desc(contentDeletionLogs.deletedAt))
      .limit(200);
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind === "card" ? "card" : "deck",
      deckName: row.deckName,
      cardCount: row.cardCount,
      cardLabel: row.cardLabel,
      deletedAt: row.deletedAt.toISOString(),
    }));
  } catch (error) {
    console.error("[content-deletion-logs] list:", error);
    return [];
  }
}
