import { db } from "@/db";
import { decks, cards, adminPrivilegeLogs } from "@/db/schema";
import { count, desc, eq, sql } from "drizzle-orm";

export async function getAdminOverviewStats() {
  const [deckStats] = await db
    .select({ totalDecks: count(decks.id) })
    .from(decks);

  const [cardStats] = await db
    .select({ totalCards: count(cards.id) })
    .from(cards);

  return {
    totalDecks: deckStats?.totalDecks ?? 0,
    totalCards: cardStats?.totalCards ?? 0,
  };
}

export async function getDeckStatsByUser(): Promise<
  {
    userId: string;
    deckCount: number;
    cardCount: number;
    lastUpdated: Date | null;
  }[]
> {
  const rows = await db
    .select({
      userId: decks.userId,
      deckCount: count(decks.id),
      cardCount: sql<number>`cast(count(${cards.id}) as integer)`,
      // PostgreSQL GREATEST ignores NULLs, so if a user has no cards the deck
      // updatedAt is returned as the fallback.
      lastUpdated: sql<Date | null>`GREATEST(MAX(${decks.updatedAt}), MAX(${cards.updatedAt}))`,
    })
    .from(decks)
    .leftJoin(cards, eq(cards.deckId, decks.id))
    .groupBy(decks.userId);

  return rows.map((r) => ({
    userId: r.userId,
    deckCount: r.deckCount,
    cardCount: Number(r.cardCount),
    lastUpdated: r.lastUpdated ? new Date(r.lastUpdated) : null,
  }));
}

export async function getAdminPrivilegeLogs(limit = 100) {
  return db
    .select()
    .from(adminPrivilegeLogs)
    .orderBy(desc(adminPrivilegeLogs.createdAt))
    .limit(limit);
}

export async function logAdminPrivilegeChange(data: {
  targetUserId: string;
  targetUserName: string;
  grantedByUserId: string;
  grantedByName: string;
  action: "granted" | "revoked";
}) {
  return db.insert(adminPrivilegeLogs).values(data);
}
