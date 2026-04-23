import { db } from "@/db";
import { decks, cards } from "@/db/schema";
import { and, count, eq, isNull } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type DeckRow = InferSelectModel<typeof decks>;

/** Drizzle projection when DB is behind schema (no `coverImageUrl` column yet). */
export const deckRowSelectWithoutCover = {
  id: decks.id,
  userId: decks.userId,
  teamId: decks.teamId,
  name: decks.name,
  description: decks.description,
  createdAt: decks.createdAt,
  updatedAt: decks.updatedAt,
} as const;

export function isMissingDeckCoverColumnError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth++) {
    const o = current as Record<string, unknown>;
    const code = o.code;
    if (code === "42703" || code === 42703) return true;
    const message = typeof o.message === "string" ? o.message : "";
    if (
      /coverImageUrl/i.test(message) &&
      (/does not exist/i.test(message) || /undefined column/i.test(message))
    ) {
      return true;
    }
    current = o.cause;
  }
  const flat = String(error);
  if (
    /coverImageUrl/i.test(flat) &&
    (/42703/.test(flat) || /does not exist/i.test(flat) || /column .* not exist/i.test(flat))
  ) {
    return true;
  }
  // Some drivers only surface the SQL text (e.g. `Failed query: select … "coverImageUrl" …`).
  if (/Failed query:/i.test(flat) && /"coverImageUrl"/i.test(flat)) {
    return true;
  }
  return false;
}

function withNullCover<T extends Omit<DeckRow, "coverImageUrl">>(row: T): DeckRow {
  return { ...row, coverImageUrl: null };
}

export async function getDecksByUser(userId: string): Promise<DeckRow[]> {
  try {
    return await db.select().from(decks).where(eq(decks.userId, userId));
  } catch (e) {
    if (!isMissingDeckCoverColumnError(e)) throw e;
    const rows = await db
      .select(deckRowSelectWithoutCover)
      .from(decks)
      .where(eq(decks.userId, userId));
    return rows.map(withNullCover);
  }
}

export async function countPersonalDecksForUser(userId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(decks)
    .where(and(eq(decks.userId, userId), isNull(decks.teamId)));
  return Number(row?.n ?? 0);
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

/** Personal dashboard — excludes decks tied to a team workspace (`teamId` set). */
export async function getPersonalDecksByUserWithCardCount(userId: string) {
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
    .where(and(eq(decks.userId, userId), isNull(decks.teamId)))
    .groupBy(
      decks.id,
      decks.userId,
      decks.name,
      decks.description,
      decks.createdAt,
      decks.updatedAt,
    );
}

export async function getDeckById(deckId: number, userId: string): Promise<DeckRow | null> {
  try {
    const rows = await db
      .select()
      .from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.userId, userId)));
    return rows[0] ?? null;
  } catch (e) {
    if (!isMissingDeckCoverColumnError(e)) throw e;
    const rows = await db
      .select(deckRowSelectWithoutCover)
      .from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.userId, userId)));
    const row = rows[0];
    return row ? withNullCover(row) : null;
  }
}

/** Internal use after authorization in team access helpers — not a security boundary alone. */
export async function getDeckRowById(deckId: number): Promise<DeckRow | null> {
  try {
    const rows = await db.select().from(decks).where(eq(decks.id, deckId));
    return rows[0] ?? null;
  } catch (e) {
    if (!isMissingDeckCoverColumnError(e)) throw e;
    const rows = await db
      .select(deckRowSelectWithoutCover)
      .from(decks)
      .where(eq(decks.id, deckId));
    const row = rows[0];
    return row ? withNullCover(row) : null;
  }
}

export async function createDeck(
  userId: string,
  name: string,
  description?: string,
  teamId?: number | null,
): Promise<number> {
  const [row] = await db
    .insert(decks)
    .values({ userId, name, description, teamId: teamId ?? null })
    .returning({ id: decks.id });
  if (!row) throw new Error("Failed to create deck");
  return row.id;
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

export async function setDeckCoverImageUrl(
  deckId: number,
  deckOwnerUserId: string,
  coverImageUrl: string | null,
) {
  return db
    .update(decks)
    .set({ coverImageUrl, updatedAt: new Date() })
    .where(and(eq(decks.id, deckId), eq(decks.userId, deckOwnerUserId)));
}

export async function deleteDeck(deckId: number, userId: string) {
  return db
    .delete(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId)));
}
