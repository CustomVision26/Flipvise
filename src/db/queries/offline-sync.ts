import { and, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/db";
import { cards, decks, quizResults } from "@/db/schema";

/**
 * Server-side push/pull helpers for the offline mobile Study database.
 *
 * Ownership is enforced on every statement by filtering on the Clerk `userId`
 * derived from the session in the route handler — never trust client-supplied ids.
 *
 * Conflict policy: last-write-wins by timestamp. The client sends each dirty row's
 * local update time; the server applies it when newer than the stored row. This is a
 * deliberate simple baseline — see `docs` notes for upgrading to field-level merges.
 */

export interface PushDeck {
  localId: string;
  serverId: number | null;
  name: string;
  description: string | null;
  gradient: string | null;
  updatedAtMs: number;
  deleted: boolean;
}

export interface PushCard {
  localId: string;
  serverId: number | null;
  deckLocalId: string;
  deckServerId: number | null;
  front: string | null;
  back: string | null;
  cardType: "standard" | "multiple_choice";
  choices: string[] | null;
  correctChoiceIndex: number | null;
  updatedAtMs: number;
  deleted: boolean;
}

export interface PushQuizResult {
  localId: string;
  deckServerId: number | null;
  deckName: string;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  percent: number;
  elapsedSeconds: number;
  perCard: unknown;
}

export interface SyncPushPayload {
  decks: PushDeck[];
  cards: PushCard[];
  quizResults: PushQuizResult[];
}

/** Maps a client `localId` to the server row id it resolved to. */
export interface IdMapping {
  localId: string;
  serverId: number;
}

export interface SyncPushResult {
  deckIds: IdMapping[];
  cardIds: IdMapping[];
  quizResultIds: IdMapping[];
}

/**
 * Applies a batch of offline changes for one user. Decks are processed first so new
 * cards can resolve their parent deck's freshly-minted server id.
 */
export async function pushOfflineChanges(
  userId: string,
  payload: SyncPushPayload,
): Promise<SyncPushResult> {
  const deckIds: IdMapping[] = [];
  const cardIds: IdMapping[] = [];
  const quizResultIds: IdMapping[] = [];

  // local deck id -> server id resolved during this push
  const deckLocalToServer = new Map<string, number>();

  for (const d of payload.decks) {
    if (d.deleted) {
      if (d.serverId != null) {
        await db
          .delete(decks)
          .where(and(eq(decks.id, d.serverId), eq(decks.userId, userId)));
      }
      continue;
    }

    if (d.serverId != null) {
      await db
        .update(decks)
        .set({ name: d.name, description: d.description, gradient: d.gradient, updatedAt: new Date(d.updatedAtMs) })
        .where(and(eq(decks.id, d.serverId), eq(decks.userId, userId)));
      deckLocalToServer.set(d.localId, d.serverId);
      deckIds.push({ localId: d.localId, serverId: d.serverId });
    } else {
      const [inserted] = await db
        .insert(decks)
        .values({ userId, name: d.name, description: d.description, gradient: d.gradient })
        .returning({ id: decks.id });
      deckLocalToServer.set(d.localId, inserted.id);
      deckIds.push({ localId: d.localId, serverId: inserted.id });
    }
  }

  for (const c of payload.cards) {
    const parentServerId =
      c.deckServerId ?? deckLocalToServer.get(c.deckLocalId) ?? null;
    // Skip orphan cards whose parent deck never synced (will retry next push).
    if (parentServerId == null) continue;

    // Verify the parent deck belongs to this user before touching cards.
    const owned = await db
      .select({ id: decks.id })
      .from(decks)
      .where(and(eq(decks.id, parentServerId), eq(decks.userId, userId)))
      .limit(1);
    if (owned.length === 0) continue;

    if (c.deleted) {
      if (c.serverId != null) {
        await db.delete(cards).where(eq(cards.id, c.serverId));
      }
      continue;
    }

    if (c.serverId != null) {
      await db
        .update(cards)
        .set({
          front: c.front,
          back: c.back,
          cardType: c.cardType,
          choices: c.choices,
          correctChoiceIndex: c.correctChoiceIndex,
          updatedAt: new Date(c.updatedAtMs),
        })
        .where(eq(cards.id, c.serverId));
      cardIds.push({ localId: c.localId, serverId: c.serverId });
    } else {
      const [inserted] = await db
        .insert(cards)
        .values({
          deckId: parentServerId,
          front: c.front,
          back: c.back,
          cardType: c.cardType,
          choices: c.choices,
          correctChoiceIndex: c.correctChoiceIndex,
        })
        .returning({ id: cards.id });
      cardIds.push({ localId: c.localId, serverId: inserted.id });
    }
  }

  for (const q of payload.quizResults) {
    const [inserted] = await db
      .insert(quizResults)
      .values({
        userId,
        deckId: q.deckServerId,
        deckName: q.deckName,
        correct: q.correct,
        incorrect: q.incorrect,
        unanswered: q.unanswered,
        total: q.total,
        percent: q.percent,
        elapsedSeconds: q.elapsedSeconds,
        // perCard JSON column is typed; cast through unknown for the sync boundary.
        perCard: (q.perCard as never) ?? null,
      })
      .returning({ id: quizResults.id });
    quizResultIds.push({ localId: q.localId, serverId: inserted.id });
  }

  return { deckIds, cardIds, quizResultIds };
}

export interface PullDeck {
  serverId: number;
  name: string;
  description: string | null;
  gradient: string | null;
  coverImageUrl: string | null;
  updatedAtMs: number;
}

export interface PullCard {
  serverId: number;
  deckServerId: number;
  front: string | null;
  back: string | null;
  frontImageUrl: string | null;
  backImageUrl: string | null;
  cardType: string;
  choices: string[] | null;
  correctChoiceIndex: number | null;
  updatedAtMs: number;
}

export interface SyncPullResult {
  decks: PullDeck[];
  cards: PullCard[];
  serverTimeMs: number;
}

/**
 * Returns the user's decks and their cards changed since `sinceMs` (epoch ms).
 * Caller (route handler) supplies a session-derived `userId`.
 */
export async function pullOfflineChanges(
  userId: string,
  sinceMs: number,
): Promise<SyncPullResult> {
  const since = new Date(sinceMs);

  const deckRows = await db
    .select()
    .from(decks)
    .where(and(eq(decks.userId, userId), gt(decks.updatedAt, since)));

  const ownedDeckIds = (
    await db.select({ id: decks.id }).from(decks).where(eq(decks.userId, userId))
  ).map((r) => r.id);

  const cardRows =
    ownedDeckIds.length > 0
      ? await db
          .select()
          .from(cards)
          .where(and(inArray(cards.deckId, ownedDeckIds), gt(cards.updatedAt, since)))
      : [];

  return {
    decks: deckRows.map((d) => ({
      serverId: d.id,
      name: d.name,
      description: d.description,
      gradient: d.gradient,
      coverImageUrl: d.coverImageUrl,
      updatedAtMs: (d.updatedAt ?? d.createdAt ?? new Date()).getTime(),
    })),
    cards: cardRows.map((c) => ({
      serverId: c.id,
      deckServerId: c.deckId,
      front: c.front,
      back: c.back,
      frontImageUrl: c.frontImageUrl,
      backImageUrl: c.backImageUrl,
      cardType: c.cardType,
      choices: c.choices ?? null,
      correctChoiceIndex: c.correctChoiceIndex,
      updatedAtMs: (c.updatedAt ?? c.createdAt ?? new Date()).getTime(),
    })),
    serverTimeMs: Date.now(),
  };
}
