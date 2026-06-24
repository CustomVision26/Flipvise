/**
 * On-device SQLite schema for the Flipvise offline Study experience.
 *
 * This mirrors the subset of the server Postgres schema (`src/db/schema.ts`) that the
 * offline experience needs: `decks`, `cards`, and locally-recorded `quiz_results`.
 * It intentionally does NOT mirror teams/billing/admin/affiliate tables — those are
 * online-only by design.
 *
 * Sync bookkeeping columns:
 * - `server_id`      : the Postgres row id once the row exists on the server (null = never synced).
 * - `updated_at_ms`  : last local mutation time (epoch ms) for last-write-wins reconciliation.
 * - `dirty`          : 1 when the row has unsynced local changes that must be pushed.
 * - `deleted`        : 1 = tombstone; kept until the deletion is confirmed pushed, then purged.
 *
 * Local primary keys are client-generated UUIDs (`local_id`) so rows can be created
 * fully offline before they ever receive a server id.
 */

export const OFFLINE_DB_NAME = "flipvise_offline";
export const OFFLINE_DB_VERSION = 2;

/** DDL executed on first open / upgrade. Statements are idempotent (IF NOT EXISTS). */
export const OFFLINE_SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS decks (
     local_id      TEXT PRIMARY KEY NOT NULL,
     server_id     INTEGER,
     user_id       TEXT NOT NULL,
     name          TEXT NOT NULL,
     description   TEXT,
     gradient      TEXT,
     cover_image_url TEXT,
     created_at_ms INTEGER NOT NULL,
     updated_at_ms INTEGER NOT NULL,
     dirty         INTEGER NOT NULL DEFAULT 0,
     deleted         INTEGER NOT NULL DEFAULT 0,
     team_id         INTEGER,
     member_assigned INTEGER NOT NULL DEFAULT 0
   );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS decks_server_id_uidx
     ON decks(server_id) WHERE server_id IS NOT NULL;`,
  `CREATE INDEX IF NOT EXISTS decks_user_idx ON decks(user_id);`,
  `CREATE INDEX IF NOT EXISTS decks_team_idx ON decks(team_id);`,

  `CREATE TABLE IF NOT EXISTS cards (
     local_id           TEXT PRIMARY KEY NOT NULL,
     server_id          INTEGER,
     deck_local_id      TEXT NOT NULL,
     deck_server_id     INTEGER,
     front              TEXT,
     back               TEXT,
     front_image_url    TEXT,
     back_image_url     TEXT,
     card_type          TEXT NOT NULL DEFAULT 'standard',
     choices_json       TEXT,
     correct_choice_index INTEGER,
     created_at_ms      INTEGER NOT NULL,
     updated_at_ms      INTEGER NOT NULL,
     dirty              INTEGER NOT NULL DEFAULT 0,
     deleted            INTEGER NOT NULL DEFAULT 0,
     FOREIGN KEY (deck_local_id) REFERENCES decks(local_id) ON DELETE CASCADE
   );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS cards_server_id_uidx
     ON cards(server_id) WHERE server_id IS NOT NULL;`,
  `CREATE INDEX IF NOT EXISTS cards_deck_idx ON cards(deck_local_id);`,

  `CREATE TABLE IF NOT EXISTS quiz_results (
     local_id        TEXT PRIMARY KEY NOT NULL,
     server_id       INTEGER,
     user_id         TEXT NOT NULL,
     deck_local_id   TEXT,
     deck_server_id  INTEGER,
     deck_name       TEXT NOT NULL,
     correct         INTEGER NOT NULL,
     incorrect       INTEGER NOT NULL,
     unanswered      INTEGER NOT NULL,
     total           INTEGER NOT NULL,
     percent         INTEGER NOT NULL,
     elapsed_seconds INTEGER NOT NULL DEFAULT 0,
     per_card_json   TEXT,
     saved_at_ms     INTEGER NOT NULL,
     dirty           INTEGER NOT NULL DEFAULT 1,
     deleted         INTEGER NOT NULL DEFAULT 0
   );`,
  `CREATE INDEX IF NOT EXISTS quiz_results_user_idx ON quiz_results(user_id);`,

  /** Single-row table tracking the last successful pull, for incremental sync. */
  `CREATE TABLE IF NOT EXISTS sync_state (
     id              INTEGER PRIMARY KEY CHECK (id = 1),
     last_pulled_ms  INTEGER NOT NULL DEFAULT 0,
     last_synced_ms  INTEGER NOT NULL DEFAULT 0
   );`,
  `INSERT OR IGNORE INTO sync_state (id, last_pulled_ms, last_synced_ms) VALUES (1, 0, 0);`,
];

/** Idempotent ALTERs for devices opened on schema v1. */
export const OFFLINE_SCHEMA_MIGRATIONS: string[] = [
  `ALTER TABLE decks ADD COLUMN team_id INTEGER;`,
  `ALTER TABLE decks ADD COLUMN member_assigned INTEGER NOT NULL DEFAULT 0;`,
];

/** Local row shapes (snake_case to match the SQLite columns above). */
export interface OfflineDeckRow {
  local_id: string;
  server_id: number | null;
  user_id: string;
  name: string;
  description: string | null;
  gradient: string | null;
  cover_image_url: string | null;
  created_at_ms: number;
  updated_at_ms: number;
  dirty: number;
  deleted: number;
  team_id: number | null;
  member_assigned: number;
}

export interface OfflineCardRow {
  local_id: string;
  server_id: number | null;
  deck_local_id: string;
  deck_server_id: number | null;
  front: string | null;
  back: string | null;
  front_image_url: string | null;
  back_image_url: string | null;
  card_type: string;
  choices_json: string | null;
  correct_choice_index: number | null;
  created_at_ms: number;
  updated_at_ms: number;
  dirty: number;
  deleted: number;
}

export interface OfflineQuizResultRow {
  local_id: string;
  server_id: number | null;
  user_id: string;
  deck_local_id: string | null;
  deck_server_id: number | null;
  deck_name: string;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  percent: number;
  elapsed_seconds: number;
  per_card_json: string | null;
  saved_at_ms: number;
  dirty: number;
  deleted: number;
}
