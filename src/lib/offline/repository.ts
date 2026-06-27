"use client";

import { getOfflineDb, persistOfflineDb } from "./db";
import type {
  OfflineCardRow,
  OfflineDeckRow,
} from "./schema";
import type { OfflineWorkspaceRole } from "./access-context";

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

/**
 * Personal dashboard — decks the user authored on the server (`decks.userId`).
 * Matches online `getPersonalDecksByUserWithCardCount` and excludes invited-workspace
 * study copies (those use `owner_user_id` of the workspace subscriber).
 */
export async function listPersonalDecks(
  userId: string,
  options?: {
    /** Workspaces the user was invited to (not subscriber-owned) — legacy rows only. */
    invitedWorkspaceTeamIds?: ReadonlySet<number>;
  },
): Promise<OfflineDeckRow[]> {
  const db = await getOfflineDb();
  const res = await db.query(
    `SELECT * FROM decks
     WHERE deleted = 0
     ORDER BY updated_at_ms DESC;`,
    [],
  );
  const invitedTeams = options?.invitedWorkspaceTeamIds;

  return ((res.values ?? []) as OfflineDeckRow[]).filter((deck) => {
    const ownerId = deck.owner_user_id?.trim();
    if (ownerId) return ownerId === userId;

    // Legacy rows (before `owner_user_id` backfill): session `user_id` is on every synced row.
    if (deck.user_id !== userId) return false;
    const onInvitedWorkspace =
      deck.team_id != null && (invitedTeams?.has(deck.team_id) ?? false);
    if (onInvitedWorkspace) return false;
    // Personal decks may have been mis-tagged `member_assigned` during an earlier sync.
    return true;
  });
}

/**
 * Team workspace — subscriber owner library, or assigned decks for invited members/admins.
 */
export async function listTeamWorkspaceDecks(
  userId: string,
  teamId: number,
  role: OfflineWorkspaceRole,
  options?: { workspaceDeckServerIds?: number[] },
): Promise<OfflineDeckRow[]> {
  const db = await getOfflineDb();
  const assignedOnly = role === "team_member" || role === "team_admin";
  const memberFlag = assignedOnly ? 1 : 0;
  const serverIds = options?.workspaceDeckServerIds?.filter((id) => Number.isFinite(id));

  // Prefer server-id manifest (linked personal decks often have `team_id` NULL on the server).
  if (serverIds && serverIds.length > 0) {
    const placeholders = serverIds.map(() => "?").join(", ");
    const res = await db.query(
      `SELECT * FROM decks
       WHERE user_id = ? AND deleted = 0
         AND COALESCE(member_assigned, 0) = ?
         AND server_id IN (${placeholders})
       ORDER BY updated_at_ms DESC;`,
      [userId, memberFlag, ...serverIds],
    );
    return (res.values ?? []) as OfflineDeckRow[];
  }

  const res = await db.query(
    assignedOnly
      ? `SELECT * FROM decks
         WHERE user_id = ? AND deleted = 0 AND team_id = ?
           AND COALESCE(member_assigned, 0) = 1
         ORDER BY updated_at_ms DESC;`
      : `SELECT * FROM decks
         WHERE user_id = ? AND deleted = 0 AND team_id = ?
           AND COALESCE(member_assigned, 0) = 0
         ORDER BY updated_at_ms DESC;`,
    [userId, teamId],
  );
  return (res.values ?? []) as OfflineDeckRow[];
}

export async function listDecksForScope(
  userId: string,
  scope: OfflineWorkspaceScope,
  workspaceRole?: OfflineWorkspaceRole,
  options?: {
    invitedWorkspaceTeamIds?: ReadonlySet<number>;
    workspaceDeckServerIds?: number[];
  },
): Promise<OfflineDeckRow[]> {
  if (scope.kind === "personal") {
    return listPersonalDecks(userId, options);
  }
  return listTeamWorkspaceDecks(
    userId,
    scope.teamId,
    workspaceRole ?? "team_member",
    options?.workspaceDeckServerIds != null
      ? { workspaceDeckServerIds: options.workspaceDeckServerIds }
      : undefined,
  );
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

export async function countOwnedDecks(
  userId: string,
  options?: { invitedWorkspaceTeamIds?: ReadonlySet<number> },
): Promise<number> {
  const decks = await listPersonalDecks(userId, options);
  return decks.length;
}

export async function countWorkspaceDecks(
  userId: string,
  teamId: number,
  role: OfflineWorkspaceRole,
): Promise<number> {
  const db = await getOfflineDb();
  const assignedOnly = role === "team_member" || role === "team_admin";
  const res = await db.query(
    assignedOnly
      ? `SELECT COUNT(*) AS n FROM decks
         WHERE user_id = ? AND deleted = 0 AND team_id = ?
           AND COALESCE(member_assigned, 0) = 1;`
      : `SELECT COUNT(*) AS n FROM decks
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
  coverImageUrl?: string | null;
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
       (local_id, server_id, user_id, owner_user_id, name, description, gradient, cover_image_url,
        created_at_ms, updated_at_ms, dirty, deleted, team_id, member_assigned)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?);`,
    [
      localId,
      input.userId,
      input.userId,
      input.name,
      input.description ?? null,
      input.gradient ?? null,
      input.coverImageUrl ?? null,
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

/** Backfill team_id / member_assigned from the sync manifest (linked decks may lack team_id). */
export async function repairTeamWorkspaceDeckRows(
  userId: string,
  workspaces: ReadonlyArray<{
    teamId: number;
    role: OfflineWorkspaceRole;
    workspaceDeckServerIds?: number[];
  }>,
): Promise<void> {
  const db = await getOfflineDb();
  for (const ws of workspaces) {
    const ids = ws.workspaceDeckServerIds?.filter((id) => Number.isFinite(id));
    if (!ids?.length) continue;
    const memberAssigned =
      ws.role === "team_member" || ws.role === "team_admin" ? 1 : 0;
    for (const serverId of ids) {
      await db.run(
        `UPDATE decks
         SET team_id = ?, member_assigned = ?
         WHERE user_id = ? AND server_id = ? AND deleted = 0 AND dirty = 0;`,
        [ws.teamId, memberAssigned, userId, serverId],
      );
    }
  }
  await persistOfflineDb();
}

/** Clears mistaken `member_assigned` flags on rows the user authored (post-sync repair). */
export async function repairPersonalDeckRows(userId: string): Promise<void> {
  const db = await getOfflineDb();
  await db.run(
    `UPDATE decks SET member_assigned = 0
     WHERE deleted = 0 AND owner_user_id = ? AND COALESCE(member_assigned, 0) != 0;`,
    [userId],
  );
  await persistOfflineDb();
}

export async function updateDeck(
  localId: string,
  patch: {
    name?: string;
    description?: string | null;
    gradient?: string | null;
    coverImageUrl?: string | null;
  },
): Promise<void> {
  const db = await getOfflineDb();
  const fields: string[] = [];
  const params: (string | number | null)[] = [];
  if (patch.name !== undefined) { fields.push("name = ?"); params.push(patch.name); }
  if (patch.description !== undefined) { fields.push("description = ?"); params.push(patch.description); }
  if (patch.gradient !== undefined) { fields.push("gradient = ?"); params.push(patch.gradient); }
  if (patch.coverImageUrl !== undefined) {
    fields.push("cover_image_url = ?");
    params.push(patch.coverImageUrl);
  }
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
  frontImageUrl?: string | null;
  backImageUrl?: string | null;
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
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0);`,
    [
      localId,
      input.deckLocalId,
      deck?.server_id ?? null,
      input.front ?? null,
      input.back ?? null,
      input.frontImageUrl ?? null,
      input.backImageUrl ?? null,
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
  patch: {
    front?: string | null;
    back?: string | null;
    frontImageUrl?: string | null;
    backImageUrl?: string | null;
  },
): Promise<void> {
  const db = await getOfflineDb();
  const fields: string[] = [];
  const params: (string | number | null)[] = [];
  if (patch.front !== undefined) { fields.push("front = ?"); params.push(patch.front); }
  if (patch.back !== undefined) { fields.push("back = ?"); params.push(patch.back); }
  if (patch.frontImageUrl !== undefined) {
    fields.push("front_image_url = ?");
    params.push(patch.frontImageUrl);
  }
  if (patch.backImageUrl !== undefined) {
    fields.push("back_image_url = ?");
    params.push(patch.backImageUrl);
  }
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
