"use client";

/**
 * Client sync engine for the offline Study database.
 *
 * Flow (single round-trip):
 *  1. Collect all `dirty` rows (decks, cards, quiz results) from local SQLite.
 *  2. POST them to `/api/sync` along with `last_pulled_ms`.
 *  3. Apply the returned id map (local_id -> server_id) and clear dirty flags / purge
 *     tombstones for rows the server confirmed.
 *  4. Merge pulled server rows (last-write-wins by `updated_at_ms`).
 *
 * Auth: from the live (same-origin) site this relies on the Clerk session cookie. From
 * the bundled native app it sends a long-lived device sync token as a Bearer header
 * (minted from the authenticated session via "Make available offline").
 */

import { getOfflineDb, isOfflineDbAvailable, persistOfflineDb } from "./db";
import { setOfflineAccessContext } from "./access-context";
import { repairTeamWorkspaceDeckRows } from "./repository";
import {
  cacheLibraryImages,
  remoteUrlForPush,
  uploadPendingLocalImages,
} from "./image-store";
import { resetWorkspaceScopeToPersonal } from "./workspace-scope";
import {
  clearPendingOfflinePull,
  getPendingOfflinePull,
  setPendingOfflinePull,
} from "./session";
import type {
  OfflineCardRow,
  OfflineDeckRow,
  OfflineQuizResultRow,
} from "./schema";

interface IdMapping {
  localId: string;
  serverId: number;
}

interface SyncResponse {
  idMap: {
    deckIds: IdMapping[];
    cardIds: IdMapping[];
    quizResultIds: IdMapping[];
  };
  pull: {
    decks: {
      serverId: number;
      ownerUserId: string;
      teamId: number | null;
      memberAssigned: boolean;
      name: string;
      description: string | null;
      gradient: string | null;
      coverImageUrl: string | null;
      updatedAtMs: number;
    }[];
    cards: {
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
    }[];
    serverTimeMs: number;
  };
  context?: {
    maxPersonalDecks: number;
    maxCardsPerDeck: number;
    workspaces: {
      teamId: number;
      name: string;
      planSlug: string;
      planLabel: string;
      role: "owner" | "team_admin" | "team_member";
      teamMemberId: number;
      canAccessTeamAdmin: boolean;
      maxDecksPerWorkspace: number;
      maxCardsPerDeck: number;
      canCreateDeck: boolean;
      ownerDisplayName?: string;
      isSubscriberOwned?: boolean;
      workspaceDeckServerIds?: number[];
    }[];
    personalPlanLabel?: string;
    personalAccountPlanLabel?: string;
    personalPlanAccessType?: string;
    personalHasTeamTierPlan?: boolean;
    viewerDisplayName?: string;
    viewerEmail?: string | null;
    updatedAtMs: number;
  };
}

export interface SyncOptions {
  /** Current Clerk user id — stamped onto pulled rows so local reads filter correctly. */
  userId: string;
  /** Origin of the live app (e.g. https://flipvise-sjgw.onrender.com). Defaults to same-origin. */
  apiBaseUrl?: string;
  /**
   * Device sync token. When set, sent as `Authorization: Bearer <token>` (used by the
   * bundled native app, which has no Clerk cookie). When omitted, the request relies on
   * the same-origin Clerk session cookie.
   */
  token?: string;
  /** Forwarded to fetch — defaults to "include" (cookie) or "omit" when a token is used. */
  credentials?: RequestCredentials;
  /**
   * When true, requests a full library download (`since: 0`) — used by
   * "Make available offline" so every accessible deck is seeded on the device.
   */
  fullPull?: boolean;
}

/** Clears the incremental pull cursor so the next sync re-downloads all accessible rows. */
export async function resetSyncPullCursor(): Promise<void> {
  const db = await getOfflineDb();
  await db.run(`UPDATE sync_state SET last_pulled_ms = 0 WHERE id = 1;`);
  await persistOfflineDb();
}

const EMPTY_PUSH = { decks: [], cards: [], quizResults: [] };

async function postSyncRequest(
  options: SyncOptions,
  body: {
    since: number;
    fullPull: boolean;
    push: {
      decks: unknown[];
      cards: unknown[];
      quizResults: unknown[];
    };
  },
): Promise<SyncResponse> {
  const base = options.apiBaseUrl ?? "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const res = await fetch(`${base}/api/sync`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    credentials: options.credentials ?? (options.token ? "omit" : "include"),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Sync failed: ${res.status} ${res.statusText}${detail ? ` — ${detail.slice(0, 120)}` : ""}`,
    );
  }
  return (await res.json()) as SyncResponse;
}

/** Downloads the full library from `/api/sync` without reading or writing local SQLite. */
export async function fetchFullOfflinePull(
  options: SyncOptions,
): Promise<SyncResponse> {
  return postSyncRequest(options, {
    since: 0,
    fullPull: true,
    push: EMPTY_PUSH,
  });
}

/**
 * "Make available offline" entry point — writes to SQLite when possible, otherwise
 * stashes the pull in Preferences for the bundled offline shell to import on open.
 */
export async function seedOfflineLibrary(options: SyncOptions): Promise<{
  deckCount: number;
  cardCount: number;
  deferredToOfflineShell: boolean;
}> {
  if (await isOfflineDbAvailable()) {
    if (options.fullPull) {
      try {
        await resetSyncPullCursor();
      } catch {
        // non-fatal
      }
    }
    const result = await runSync(options);
    if (options.fullPull) {
      await resetWorkspaceScopeToPersonal();
    }
    return {
      deckCount: result.deckCount,
      cardCount: result.cardCount,
      deferredToOfflineShell: false,
    };
  }

  const data = await fetchFullOfflinePull(options);
  await setPendingOfflinePull(options.userId, JSON.stringify(data));
  if (data.context) {
    await persistOfflineAccessContext(options.userId, data.context);
  }
  await resetWorkspaceScopeToPersonal();
  return {
    deckCount: data.pull.decks.length,
    cardCount: data.pull.cards.length,
    deferredToOfflineShell: true,
  };
}

/** Imports a stashed pull (from the live dashboard) into SQLite, then clears the stash. */
export async function consumePendingOfflinePull(): Promise<{
  deckCount: number;
  cardCount: number;
} | null> {
  const pending = await getPendingOfflinePull();
  if (!pending) return null;
  if (!(await isOfflineDbAvailable())) return null;

  let data: SyncResponse;
  try {
    data = JSON.parse(pending.payloadJson) as SyncResponse;
  } catch {
    await clearPendingOfflinePull();
    return null;
  }

  try {
    await resetSyncPullCursor();
  } catch {
    // non-fatal
  }
  // The stashed pull is always a full library download, so reconcile server deletions.
  await applyServerResponse(data, pending.userId, { reconcile: true });
  if (data.context) {
    await persistOfflineAccessContext(pending.userId, data.context);
  }
  await clearPendingOfflinePull();
  await resetWorkspaceScopeToPersonal();

  return {
    deckCount: data.pull.decks.length,
    cardCount: data.pull.cards.length,
  };
}

async function persistOfflineAccessContext(
  userId: string,
  context: NonNullable<SyncResponse["context"]>,
): Promise<void> {
  await setOfflineAccessContext(context);
  await repairTeamWorkspaceDeckRows(
    userId,
    context.workspaces.map((w) => ({
      teamId: w.teamId,
      role: w.role,
      workspaceDeckServerIds: w.workspaceDeckServerIds,
    })),
  ).catch(() => {});
}

async function collectDirty(): Promise<{
  decks: OfflineDeckRow[];
  cards: OfflineCardRow[];
  quizResults: OfflineQuizResultRow[];
  lastPulledMs: number;
}> {
  const db = await getOfflineDb();
  const decks = ((await db.query(`SELECT * FROM decks WHERE dirty = 1;`)).values ??
    []) as OfflineDeckRow[];
  const cards = ((await db.query(`SELECT * FROM cards WHERE dirty = 1;`)).values ??
    []) as OfflineCardRow[];
  const quizResults = ((await db.query(
    `SELECT * FROM quiz_results WHERE dirty = 1 AND deleted = 0;`,
  )).values ?? []) as OfflineQuizResultRow[];
  const stateRows = ((await db.query(`SELECT last_pulled_ms FROM sync_state WHERE id = 1;`))
    .values ?? []) as { last_pulled_ms: number }[];
  return {
    decks,
    cards,
    quizResults,
    lastPulledMs: stateRows[0]?.last_pulled_ms ?? 0,
  };
}

/** Runs a full push+pull cycle. Returns the server time used as the new pull cursor. */
export async function runSync(options: SyncOptions): Promise<{
  pushed: number;
  pulled: number;
  deckCount: number;
  cardCount: number;
}> {
  const round1 = await executeSyncRound(options);
  let pushedCount = round1.pushed;
  let pulledCount = round1.pulled;
  let deckCount = round1.deckCount;
  let cardCount = round1.cardCount;

  if (options.token && options.apiBaseUrl) {
    try {
      await uploadPendingLocalImages({
        apiBaseUrl: options.apiBaseUrl,
        token: options.token,
      });
      const round2 = await executeSyncRound(options);
      pushedCount += round2.pushed;
      pulledCount += round2.pulled;
      deckCount = round2.deckCount;
      cardCount = round2.cardCount;
    } catch {
      // Image upload is best-effort — text rows still synced in round 1.
    }
  }

  try {
    await cacheLibraryImages(true);
  } catch {
    // Cache failures should not fail the overall sync.
  }

  return {
    pushed: pushedCount,
    pulled: pulledCount,
    deckCount,
    cardCount,
  };
}

async function executeSyncRound(options: SyncOptions): Promise<{
  pushed: number;
  pulled: number;
  deckCount: number;
  cardCount: number;
}> {
  const { decks, cards, quizResults, lastPulledMs } = await collectDirty();
  const since = options.fullPull ? 0 : lastPulledMs;

  const deckServerIdByLocal = new Map(
    decks.map((d) => [d.local_id, d.server_id] as const),
  );

  const payload = {
    since,
    fullPull: options.fullPull === true,
    push: {
      decks: decks.map((d) => ({
        localId: d.local_id,
        serverId: d.server_id,
        name: d.name,
        description: d.description,
        gradient: d.gradient,
        coverImageUrl: remoteUrlForPush(d.cover_image_url),
        updatedAtMs: d.updated_at_ms,
        deleted: d.deleted === 1,
        teamId: d.team_id ?? null,
      })),
      cards: cards.map((c) => ({
        localId: c.local_id,
        serverId: c.server_id,
        deckLocalId: c.deck_local_id,
        deckServerId: c.deck_server_id,
        front: c.front,
        back: c.back,
        frontImageUrl: remoteUrlForPush(c.front_image_url),
        backImageUrl: remoteUrlForPush(c.back_image_url),
        cardType: c.card_type === "multiple_choice" ? "multiple_choice" : "standard",
        choices: c.choices_json ? (JSON.parse(c.choices_json) as string[]) : null,
        correctChoiceIndex: c.correct_choice_index,
        updatedAtMs: c.updated_at_ms,
        deleted: c.deleted === 1,
      })),
      quizResults: quizResults.map((q) => ({
        localId: q.local_id,
        deckLocalId: q.deck_local_id,
        deckServerId:
          q.deck_server_id ??
          (q.deck_local_id ? deckServerIdByLocal.get(q.deck_local_id) ?? null : null),
        deckName: q.deck_name,
        correct: q.correct,
        incorrect: q.incorrect,
        unanswered: q.unanswered,
        total: q.total,
        percent: q.percent,
        elapsedSeconds: q.elapsed_seconds,
        perCard: q.per_card_json ? JSON.parse(q.per_card_json) : null,
      })),
    },
  };

  const data = await postSyncRequest(options, payload);

  // A full pull returns the complete authoritative library, so we can safely remove
  // local rows the server no longer has (decks/cards deleted on another device or the
  // online dashboard). Incremental pulls only return changed rows, so absence there
  // does NOT imply deletion — never reconcile in that case.
  await applyServerResponse(data, options.userId, {
    reconcile: options.fullPull === true,
  });

  if (data.context) {
    await persistOfflineAccessContext(options.userId, data.context);
  }

  const pushedCount = decks.length + cards.length + quizResults.length;
  const pulledCount = data.pull.decks.length + data.pull.cards.length;
  return {
    pushed: pushedCount,
    pulled: pulledCount,
    deckCount: data.pull.decks.length,
    cardCount: data.pull.cards.length,
  };
}

async function applyServerResponse(
  data: SyncResponse,
  userId: string,
  options: { reconcile?: boolean } = {},
): Promise<void> {
  const db = await getOfflineDb();

  // 1. Stamp server ids onto pushed rows and clear dirty flags.
  for (const m of data.idMap.deckIds) {
    await db.run(
      `UPDATE decks SET server_id = ?, dirty = 0 WHERE local_id = ?;`,
      [m.serverId, m.localId],
    );
    // Backfill children that referenced this deck only by local id.
    await db.run(
      `UPDATE cards SET deck_server_id = ? WHERE deck_local_id = ?;`,
      [m.serverId, m.localId],
    );
  }
  for (const m of data.idMap.cardIds) {
    await db.run(`UPDATE cards SET server_id = ?, dirty = 0 WHERE local_id = ?;`, [
      m.serverId,
      m.localId,
    ]);
  }
  for (const m of data.idMap.quizResultIds) {
    await db.run(
      `UPDATE quiz_results SET server_id = ?, dirty = 0 WHERE local_id = ?;`,
      [m.serverId, m.localId],
    );
  }

  // 2. Purge confirmed tombstones.
  await db.run(`DELETE FROM decks WHERE deleted = 1 AND dirty = 0;`);
  await db.run(`DELETE FROM cards WHERE deleted = 1 AND dirty = 0;`);

  // 3. Merge pulled rows (last-write-wins; skip rows with newer local edits).
  //    `lower(hex(randomblob(16)))` mints a local id when the row is new locally.
  for (const d of data.pull.decks) {
    await db.run(
      `INSERT INTO decks (local_id, server_id, user_id, owner_user_id, name, description, gradient,
         cover_image_url, created_at_ms, updated_at_ms, dirty, deleted, team_id, member_assigned)
       VALUES (
         COALESCE((SELECT local_id FROM decks WHERE server_id = ?), lower(hex(randomblob(16)))),
         ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
       ON CONFLICT(local_id) DO UPDATE SET
         server_id = excluded.server_id,
         user_id = excluded.user_id,
         owner_user_id = excluded.owner_user_id,
         name = excluded.name,
         description = excluded.description,
         gradient = excluded.gradient,
         cover_image_url = excluded.cover_image_url,
         updated_at_ms = excluded.updated_at_ms,
         team_id = excluded.team_id,
         member_assigned = excluded.member_assigned
       WHERE decks.dirty = 0 AND decks.updated_at_ms <= excluded.updated_at_ms;`,
      [
        d.serverId,
        d.serverId,
        userId,
        d.ownerUserId,
        d.name,
        d.description,
        d.gradient,
        d.coverImageUrl,
        d.updatedAtMs,
        d.updatedAtMs,
        d.teamId,
        d.memberAssigned ? 1 : 0,
      ],
    );
  }
  for (const c of data.pull.cards) {
    await db.run(
      `INSERT INTO cards (local_id, server_id, deck_local_id, deck_server_id, front, back,
         front_image_url, back_image_url, card_type, choices_json, correct_choice_index,
         created_at_ms, updated_at_ms, dirty, deleted)
       VALUES (
         COALESCE((SELECT local_id FROM cards WHERE server_id = ?), lower(hex(randomblob(16)))),
         ?,
         COALESCE((SELECT local_id FROM decks WHERE server_id = ?), ''), ?,
         ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
       ON CONFLICT(local_id) DO UPDATE SET
         server_id = excluded.server_id,
         deck_server_id = excluded.deck_server_id,
         front = excluded.front,
         back = excluded.back,
         front_image_url = excluded.front_image_url,
         back_image_url = excluded.back_image_url,
         card_type = excluded.card_type,
         choices_json = excluded.choices_json,
         correct_choice_index = excluded.correct_choice_index,
         updated_at_ms = excluded.updated_at_ms
       WHERE cards.dirty = 0 AND cards.updated_at_ms <= excluded.updated_at_ms;`,
      [
        c.serverId, c.serverId, c.deckServerId, c.deckServerId,
        c.front, c.back, c.frontImageUrl, c.backImageUrl, c.cardType,
        c.choices ? JSON.stringify(c.choices) : null, c.correctChoiceIndex,
        c.updatedAtMs, c.updatedAtMs,
      ],
    );
  }

  // 3b. Reconcile server-side deletions (full pull only — see caller).
  //     The pulled set is the complete authoritative library, so any confirmed-synced
  //     local row (server_id set, not dirty) that the server didn't return has been
  //     deleted elsewhere and must be removed. Locally-created/edited rows (dirty = 1)
  //     and not-yet-pushed rows (server_id NULL) are preserved.
  if (options.reconcile) {
    // Server ids are integers, so inlining them sidesteps SQLite's bound-parameter
    // limit on large libraries while staying injection-safe.
    const pulledDeckIds = data.pull.decks
      .map((d) => Number(d.serverId))
      .filter((id) => Number.isFinite(id));
    const pulledCardIds = data.pull.cards
      .map((c) => Number(c.serverId))
      .filter((id) => Number.isFinite(id));

    if (pulledDeckIds.length > 0) {
      await db.run(
        `DELETE FROM decks WHERE server_id IS NOT NULL AND dirty = 0 AND server_id NOT IN (${pulledDeckIds.join(",")});`,
      );
    } else {
      await db.run(`DELETE FROM decks WHERE server_id IS NOT NULL AND dirty = 0;`);
    }

    if (pulledCardIds.length > 0) {
      await db.run(
        `DELETE FROM cards WHERE server_id IS NOT NULL AND dirty = 0 AND server_id NOT IN (${pulledCardIds.join(",")});`,
      );
    } else {
      await db.run(`DELETE FROM cards WHERE server_id IS NOT NULL AND dirty = 0;`);
    }

    // Drop cards orphaned by a removed deck (safety net; keep dirty rows to push later).
    await db.run(
      `DELETE FROM cards WHERE dirty = 0 AND (deck_local_id IS NULL OR deck_local_id NOT IN (SELECT local_id FROM decks));`,
    );
  }

  // 4. Advance the pull cursor.
  await db.run(`UPDATE sync_state SET last_pulled_ms = ?, last_synced_ms = ? WHERE id = 1;`, [
    data.pull.serverTimeMs,
    Date.now(),
  ]);

  await persistOfflineDb();
}
