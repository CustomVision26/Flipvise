"use client";

/**
 * Capacitor SQLite connection manager for the offline Study database.
 *
 * Client-only. Safe to import in browser/native contexts; calling `getOfflineDb()`
 * outside a Capacitor (or jeep-sqlite web) environment will reject, so callers should
 * guard with `isOfflineDbAvailable()` first.
 */

import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from "@capacitor-community/sqlite";
import { Capacitor } from "@capacitor/core";
import {
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  OFFLINE_SCHEMA_MIGRATIONS,
  OFFLINE_SCHEMA_STATEMENTS,
} from "./schema";
import { isFlipviseNativeApp } from "./is-flipvise-native-app";

let sqlite: SQLiteConnection | null = null;
let dbConnection: SQLiteDBConnection | null = null;
let openPromise: Promise<SQLiteDBConnection> | null = null;

/** True on native (iOS/Android). On web, SQLite requires the jeep-sqlite element + WASM. */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform() || isFlipviseNativeApp();
}

/** Whether the Capacitor SQLite native plugin is bridged in the current WebView. */
export function isCapacitorSqlitePluginAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Capacitor.isPluginAvailable("CapacitorSQLite");
  } catch {
    return false;
  }
}

/** Last open failure — surfaced in UI when offline storage is unavailable. */
let lastOfflineDbError: string | null = null;

export function getLastOfflineDbError(): string | null {
  return lastOfflineDbError;
}

async function initializeSchema(conn: SQLiteDBConnection): Promise<void> {
  for (const statement of OFFLINE_SCHEMA_STATEMENTS) {
    const sql = statement.trim();
    if (!sql) continue;
    await conn.execute(sql);
  }
  for (const statement of OFFLINE_SCHEMA_MIGRATIONS) {
    const sql = statement.trim();
    if (!sql) continue;
    try {
      await conn.execute(sql);
    } catch {
      // Column already exists on upgraded devices.
    }
  }
}

/** Whether an offline DB can be opened in the current runtime. */
export async function isOfflineDbAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  let shouldTry = isNativePlatform();
  if (!shouldTry) {
    try {
      const { getNativeAppFlag } = await import("./session");
      shouldTry = await getNativeAppFlag();
    } catch {
      // Preferences plugin unavailable (plain browser).
    }
  }
  if (!shouldTry) {
    try {
      const { isFlipviseNativeAppAsync } = await import("./is-flipvise-native-app");
      shouldTry = await isFlipviseNativeAppAsync();
    } catch {
      // ignore
    }
  }

  if (!shouldTry) {
    lastOfflineDbError = "Not running inside the Flipvise mobile app.";
    return (
      typeof customElements !== "undefined" &&
      customElements.get("jeep-sqlite") != null
    );
  }

  if (!isCapacitorSqlitePluginAvailable()) {
    lastOfflineDbError =
      "SQLite plugin is not available in this WebView. Rebuild the app after `npm run mobile:sync:prod`.";
    return false;
  }

  try {
    await getOfflineDb();
    lastOfflineDbError = null;
    return true;
  } catch (err) {
    lastOfflineDbError =
      err instanceof Error ? err.message : "Could not open the offline database.";
    return false;
  }
}

function getConnectionManager(): SQLiteConnection {
  if (!sqlite) sqlite = new SQLiteConnection(CapacitorSQLite);
  return sqlite;
}

/**
 * Opens (or returns the already-open) offline database connection, creating the
 * schema on first use. Concurrent callers share a single open promise.
 */
export async function getOfflineDb(): Promise<SQLiteDBConnection> {
  if (dbConnection) return dbConnection;
  if (openPromise) return openPromise;

  openPromise = (async () => {
    if (!isCapacitorSqlitePluginAvailable()) {
      throw new Error(
        "CapacitorSQLite plugin is not available. Reinstall the Flipvise app from a fresh `mobile:sync:prod` build.",
      );
    }

    const manager = getConnectionManager();

    // On web, initialize the WASM store backing jeep-sqlite once.
    if (!isNativePlatform()) {
      await manager.initWebStore();
    }

    const consistency = await manager.checkConnectionsConsistency().catch(() => ({
      result: false,
    }));
    const isConnected = (
      await manager.isConnection(OFFLINE_DB_NAME, false).catch(() => ({ result: false }))
    ).result;

    const conn =
      consistency.result && isConnected
        ? await manager.retrieveConnection(OFFLINE_DB_NAME, false)
        : await manager.createConnection(
            OFFLINE_DB_NAME,
            false,
            "no-encryption",
            OFFLINE_DB_VERSION,
            false,
          );

    await conn.open();
    await initializeSchema(conn);

    dbConnection = conn;
    lastOfflineDbError = null;
    return conn;
  })();

  try {
    return await openPromise;
  } catch (err) {
    lastOfflineDbError =
      err instanceof Error ? err.message : "Could not open the offline database.";
    throw err;
  } finally {
    openPromise = null;
  }
}

/** Persist the web WASM store to IndexedDB (no-op on native). Call after writes on web. */
export async function persistOfflineDb(): Promise<void> {
  if (isNativePlatform()) return;
  await getConnectionManager().saveToStore(OFFLINE_DB_NAME);
}

/** Closes the connection (e.g. on sign-out). */
export async function closeOfflineDb(): Promise<void> {
  if (!sqlite || !dbConnection) return;
  await sqlite.closeConnection(OFFLINE_DB_NAME, false);
  dbConnection = null;
}
