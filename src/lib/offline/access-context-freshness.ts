"use client";

import {
  defaultOfflineAccessContext,
  getOfflineAccessContext,
  type OfflineAccessContext,
} from "@/lib/offline/access-context";
import { getLastLiveDashboardVisitMs } from "@/lib/offline/session";
import { runSync } from "@/lib/offline/sync";

export type EnsureFreshOfflineAccessContextOptions = {
  userId: string;
  apiBaseUrl: string;
  token?: string | null;
  /** Skip staleness checks and always sync when online with a token. */
  force?: boolean;
  fullPull?: boolean;
  online?: boolean;
};

export type EnsureFreshOfflineAccessContextResult = {
  context: OfflineAccessContext;
  refreshed: boolean;
  staleBeforeRefresh: boolean;
};

/**
 * True when the cached workspace switcher snapshot should be refreshed from `/api/sync`.
 * Decks may still be current — this only gates workspace/plan metadata.
 */
export async function isOfflineAccessContextStale(
  ctx: OfflineAccessContext | null,
  storedUserId: string | null,
): Promise<boolean> {
  if (!ctx || ctx.updatedAtMs <= 0) return true;
  if (!storedUserId) return true;
  if (!ctx.userId || ctx.userId !== storedUserId) return true;

  const lastLiveVisitMs = await getLastLiveDashboardVisitMs();
  if (lastLiveVisitMs != null && lastLiveVisitMs > ctx.updatedAtMs) {
    return true;
  }

  return false;
}

/** Human-readable age for the workspace menu (offline-only hint). */
export function formatOfflineWorkspaceContextAge(updatedAtMs: number): string | null {
  if (updatedAtMs <= 0) return null;

  const ageMs = Math.max(0, Date.now() - updatedAtMs);
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hr${hours === 1 ? "" : "s"} ago`;

  return new Date(updatedAtMs).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * Returns cached access context, syncing from the server first when stale and online.
 * Single entry point for the offline Study shell workspace switcher.
 */
export async function ensureFreshOfflineAccessContext(
  options: EnsureFreshOfflineAccessContextOptions,
): Promise<EnsureFreshOfflineAccessContextResult> {
  const cached =
    (await getOfflineAccessContext()) ?? defaultOfflineAccessContext();
  const staleBeforeRefresh = await isOfflineAccessContextStale(
    cached,
    options.userId,
  );

  const shouldSync =
    Boolean(options.force) ||
    (staleBeforeRefresh &&
      options.online !== false &&
      Boolean(options.token?.trim()));

  if (!shouldSync) {
    return { context: cached, refreshed: false, staleBeforeRefresh };
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { context: cached, refreshed: false, staleBeforeRefresh };
  }

  try {
    await runSync({
      userId: options.userId,
      apiBaseUrl: options.apiBaseUrl,
      token: options.token ?? undefined,
      fullPull: options.fullPull === true,
    });
    const fresh =
      (await getOfflineAccessContext()) ?? defaultOfflineAccessContext();
    return { context: fresh, refreshed: true, staleBeforeRefresh };
  } catch {
    return { context: cached, refreshed: false, staleBeforeRefresh };
  }
}
