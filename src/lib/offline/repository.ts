"use client";

import { getOfflineDb, persistOfflineDb } from "./db";
import type {
  OfflineCardRow,
  OfflineDeckRow,
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

export type OfflineWorkspaceScope =
  | { kind: "personal" }
  | { kind: "team"; teamId: number };

export class OfflineLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfflineLimitError";
  }
}

// ---------------------------------------------------------------------------
// Decks
// ---------------------------------------------------------------------------

/** Personal dashboard — owned decks (excludes member-assigned study copies). */
export async function listPersonalDecks(userId: string): Promise<OfflineDeckRow[]> {
  const db = await getOfflineDb();
  const res = await db.query(
    `SELECT * FROM decks
     WHERE user_id = ? AND deleted = 0
       AND COALESCE(member_assigned, 0) = 0
     ORDER BY updated_at_ms DESC;`,
    [userId],
  );
  return (res.values ?? []) as OfflineDeckRow[];
}

/** Team workspace — decks in a workspace (owner/admin library or member assignments). */
export async function listTeamWorkspaceDecks(
  userId: string,
  teamId: number,
): Promise<OfflineDeckRow[]> {
  const db = await getOfflineDb();
  const res = await db.query(
    `SELECT * FROM decks
     WHERE user_id = ? AND deleted = 0 AND team_id = ?
     ORDER BY updated_at_ms DESC;`,
    [userId, teamId],
  );
  return (res.values ?? []) as OfflineDeckRow[];
}

export async function listDecksForScope(
  userId: string,
  scope: OfflineWorkspaceScope,
): Promise<OfflineDeckRow[]> {
  if (scope.kind === "personal") return listPersonalDecks(userId);
  return listTeamWorkspaceDecks(userId, scope.teamId);
}

/** @deprecated Use listDecksForScope — returns all non-assigned decks for the user. */
export async function listDecks(userId: string): Promise<OfflineDeckRow[]> {
  return listPersonalDecks(userId);
}

export async function getDeck(localId: string): Promise<OfflineDeckRow | null> {
  const db = await getOfflineDb();
  const res = await db.query(`SELECT * FROM decks WHERE local_id = ? LIMIT 1;`, [
    localId,
  ]);
  return ((res.values ?? [])[0] as OfflineDeckRow) ?? null;
}

export async function countOwnedDecks(userId: string): Promise<number> {
  const db = await getOfflineDb();
  const res = await db.query(
    `SELECT COUNT(*) AS n FROM decks
     WHERE user_id = ? AND deleted = 0 AND COALESCE(member_assigned, 0) = 0;`,
    [userId],
  );
  const row = (res.values ?? [])[0] as { n: number } | undefined;
  return Number(row?.n ?? 0);
}

export async function countWorkspaceDecks(
  userId: string,
  teamId: number,
): Promise<number> {
  const db = await getOfflineDb();
  const res = await db.query(
    `SELECT COUNT(*) AS n FROM decks
     WHERE user_id = ? AND deleted = 0 AND team_id = ?
       AND COALESCE(member_assigned, 0) = 0;`,
    [userId, teamId],
  );
  const row = (res.values ?? [])[0] as { n: number } | undefined;
  return Number(row?.n ?? 0);
}

export async function createDeck(input: {
  userId: string;
  name: string;
  description?: string | null;
  gradient?: string | null;
  teamId?: number | null;
  memberAssigned?: boolean;
  maxPersonalDecks?: number;
  maxDecksPerWorkspace?: number;
}): Promise<string> {
  const teamId = input.teamId ?? null;
  if (teamId != null) {
    throw new OfflineLimitError(
      "Team workspace decks can't be created offline. Use the online dashboard from your personal workspace.",
    );
  }
  const memberAssigned = input.memberAssigned ? 1 : 0;

  const max = input.maxPersonalDecks;
  if (max != null) {
    const count = await countOwnedDecks(input.userId);
    if (count >= max) {
      throw new OfflineLimitError(
        `Deck limit reached — up to ${max} personal deck(s) on your plan.`,
      );
    }
  }

  const db = await getOfflineDb();
  const localId = uuid();
  const ts = now();
  await db.run(
    `INSERT INTO decks
       (local_id, server_id, user_id, name, description, gradient, cover_image_url,
        created_at_ms, updated_at_ms, dirty, deleted, team_id, member_assigned)
     VALUES (?, NULL, ?, ?, ?, ?, NULL, ?, ?, 1, 0, ?, ?);`,
    [
      localId,
      input.userId,
      input.name,
      input.description ?? null,
      input.gradient ?? null,
      ts,
      ts,
      teamId,
      memberAssigned,
    ],
  );
  await persistOfflineDb();
  return localId;
}

/**
 * Removes team-workspace decks that were created only on-device (never synced).
 * Team decks must be created on the live dashboard, then downloaded for offline study.
 */
export async function purgeLocallyCreatedTeamDecks(userId: string): Promise<number> {
  const db = await getOfflineDb();
  const orphans = ((await db.query(
    `SELECT local_id FROM decks
     WHERE user_id = ? AND deleted = 0 AND team_id IS NOT NULL AND server_id IS NULL;`,
    [userId],
  )).values ?? []) as { local_id: string }[];

  if (orphans.length === 0) return 0;

  const ids = orphans.map((r) => r.local_id);
  const placeholders = ids.map(() => "?").join(", ");

  await db.run(
    `DELETE FROM quiz_results WHERE deck_local_id IN (${placeholders});`,
    ids,
  );
  await db.run(
    `DELETE FROM cards WHERE deck_local_id IN (${placeholders});`,
    ids,
  );
  await db.run(
    `DELETE FROM decks WHERE local_id IN (${placeholders});`,
    ids,
  );
  await persistOfflineDb();
  return ids.length;
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

export async function countCardsInDeck(deckLocalId: string): Promise<number> {
  const cards = await listCards(deckLocalId);
  return cards.length;
}

export async function createCard(input: {
  deckLocalId: string;
  front?: string | null;
  back?: string | null;
  cardType?: "standard" | "multiple_choice";
  choices?: string[] | null;
  correctChoiceIndex?: number | null;
  maxCardsPerDeck?: number;
}): Promise<string> {
  if (input.maxCardsPerDeck != null) {
    const existing = await countCardsInDeck(input.deckLocalId);
    if (existing >= input.maxCardsPerDeck) {
      throw new OfflineLimitError(
        `Card limit reached — up to ${input.maxCardsPerDeck} cards per deck on your plan.`,
      );
    }
  }

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
