"use client";

/**
 * Typed CRUD over the offline SQLite database. Every write stamps `updated_at_ms`
 * and sets `dirty = 1` so the sync engine (`./sync`) can push changes later.
 *
 * Local rows are keyed by client-generated UUID (`local_id`) so they can be created
 * offline before they ever receive a server id.
 */

import { getOfflineDb, persistOfflineDb } from "./db";
import type {
  OfflineCardRow,
  OfflineDeckRow,
  OfflineQuizResultRow,
} from "./schema";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function now(): number {
  return Date.now();
}

// ---------------------------------------------------------------------------
// Decks
// ---------------------------------------------------------------------------

export async function listDecks(userId: string): Promise<OfflineDeckRow[]> {
  const db = await getOfflineDb();
  const res = await db.query(
    `SELECT * FROM decks WHERE user_id = ? AND deleted = 0 ORDER BY updated_at_ms DESC;`,
    [userId],
  );
  return (res.values ?? []) as OfflineDeckRow[];
}

export async function getDeck(localId: string): Promise<OfflineDeckRow | null> {
  const db = await getOfflineDb();
  const res = await db.query(`SELECT * FROM decks WHERE local_id = ? LIMIT 1;`, [
    localId,
  ]);
  return ((res.values ?? [])[0] as OfflineDeckRow) ?? null;
}

export async function createDeck(input: {
  userId: string;
  name: string;
  description?: string | null;
  gradient?: string | null;
}): Promise<string> {
  const db = await getOfflineDb();
  const localId = uuid();
  const ts = now();
  await db.run(
    `INSERT INTO decks
       (local_id, server_id, user_id, name, description, gradient, cover_image_url,
        created_at_ms, updated_at_ms, dirty, deleted)
     VALUES (?, NULL, ?, ?, ?, ?, NULL, ?, ?, 1, 0);`,
    [localId, input.userId, input.name, input.description ?? null, input.gradient ?? null, ts, ts],
  );
  await persistOfflineDb();
  return localId;
}

export async function updateDeck(
  localId: string,
  patch: { name?: string; description?: string | null; gradient?: string | null },
): Promise<void> {
  const db = await getOfflineDb();
  const fields: string[] = [];
  const params: (string | number | null)[] = [];
  if (patch.name !== undefined) { fields.push("name = ?"); params.push(patch.name); }
  if (patch.description !== undefined) { fields.push("description = ?"); params.push(patch.description); }
  if (patch.gradient !== undefined) { fields.push("gradient = ?"); params.push(patch.gradient); }
  if (fields.length === 0) return;
  fields.push("updated_at_ms = ?", "dirty = 1");
  params.push(now(), localId);
  await db.run(`UPDATE decks SET ${fields.join(", ")} WHERE local_id = ?;`, params);
  await persistOfflineDb();
}

/** Soft-delete (tombstone) so the deletion can be pushed to the server. */
export async function deleteDeck(localId: string): Promise<void> {
  const db = await getOfflineDb();
  const ts = now();
  await db.run(
    `UPDATE decks SET deleted = 1, dirty = 1, updated_at_ms = ? WHERE local_id = ?;`,
    [ts, localId],
  );
  await db.run(
    `UPDATE cards SET deleted = 1, dirty = 1, updated_at_ms = ? WHERE deck_local_id = ?;`,
    [ts, localId],
  );
  await persistOfflineDb();
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export async function listCards(deckLocalId: string): Promise<OfflineCardRow[]> {
  const db = await getOfflineDb();
  const res = await db.query(
    `SELECT * FROM cards WHERE deck_local_id = ? AND deleted = 0 ORDER BY created_at_ms ASC;`,
    [deckLocalId],
  );
  return (res.values ?? []) as OfflineCardRow[];
}

export async function createCard(input: {
  deckLocalId: string;
  front?: string | null;
  back?: string | null;
  cardType?: "standard" | "multiple_choice";
  choices?: string[] | null;
  correctChoiceIndex?: number | null;
}): Promise<string> {
  const db = await getOfflineDb();
  const deck = await getDeck(input.deckLocalId);
  const localId = uuid();
  const ts = now();
  await db.run(
    `INSERT INTO cards
       (local_id, server_id, deck_local_id, deck_server_id, front, back,
        front_image_url, back_image_url, card_type, choices_json, correct_choice_index,
        created_at_ms, updated_at_ms, dirty, deleted)
     VALUES (?, NULL, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, 1, 0);`,
    [
      localId,
      input.deckLocalId,
      deck?.server_id ?? null,
      input.front ?? null,
      input.back ?? null,
      input.cardType ?? "standard",
      input.choices ? JSON.stringify(input.choices) : null,
      input.correctChoiceIndex ?? null,
      ts,
      ts,
    ],
  );
  await persistOfflineDb();
  return localId;
}

export async function updateCard(
  localId: string,
  patch: { front?: string | null; back?: string | null },
): Promise<void> {
  const db = await getOfflineDb();
  const fields: string[] = [];
  const params: (string | number | null)[] = [];
  if (patch.front !== undefined) { fields.push("front = ?"); params.push(patch.front); }
  if (patch.back !== undefined) { fields.push("back = ?"); params.push(patch.back); }
  if (fields.length === 0) return;
  fields.push("updated_at_ms = ?", "dirty = 1");
  params.push(now(), localId);
  await db.run(`UPDATE cards SET ${fields.join(", ")} WHERE local_id = ?;`, params);
  await persistOfflineDb();
}

export async function deleteCard(localId: string): Promise<void> {
  const db = await getOfflineDb();
  await db.run(
    `UPDATE cards SET deleted = 1, dirty = 1, updated_at_ms = ? WHERE local_id = ?;`,
    [now(), localId],
  );
  await persistOfflineDb();
}

// ---------------------------------------------------------------------------
// Quiz results (write-only offline; pushed up on sync)
// ---------------------------------------------------------------------------

export async function recordQuizResult(input: {
  userId: string;
  deckLocalId: string | null;
  deckName: string;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  percent: number;
  elapsedSeconds: number;
  perCard?: unknown;
}): Promise<string> {
  const db = await getOfflineDb();
  const localId = uuid();
  await db.run(
    `INSERT INTO quiz_results
       (local_id, server_id, user_id, deck_local_id, deck_server_id, deck_name,
        correct, incorrect, unanswered, total, percent, elapsed_seconds,
        per_card_json, saved_at_ms, dirty, deleted)
     VALUES (?, NULL, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0);`,
    [
      localId,
      input.userId,
      input.deckLocalId,
      input.deckName,
      input.correct,
      input.incorrect,
      input.unanswered,
      input.total,
      input.percent,
      input.elapsedSeconds,
      input.perCard ? JSON.stringify(input.perCard) : null,
      now(),
    ],
  );
  await persistOfflineDb();
  return localId;
}
