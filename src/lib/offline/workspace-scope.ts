"use client";

/**
 * Persists the offline Study workspace scope (personal vs team id) in Capacitor
 * Preferences so it survives navigation between the bundled shell and the live
 * site (different WebView origins — localStorage is not shared).
 */

import { Preferences } from "@capacitor/preferences";

const PREFS_SCOPE_KEY = "flipvise.offline.workspaceScope";

export type SavedWorkspaceScope = "personal" | number;

function parseScope(raw: string | null | undefined): SavedWorkspaceScope {
  if (!raw || raw === "personal") return "personal";
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : "personal";
}

/** Sync read for same-origin UI (localStorage). */
export function loadWorkspaceScopeFromStorage(): SavedWorkspaceScope {
  try {
    const raw = localStorage.getItem(PREFS_SCOPE_KEY);
    return parseScope(raw);
  } catch {
    return "personal";
  }
}

export function saveWorkspaceScopeToStorage(scope: SavedWorkspaceScope): void {
  try {
    localStorage.setItem(
      PREFS_SCOPE_KEY,
      scope === "personal" ? "personal" : String(scope),
    );
  } catch {
    // ignore
  }
}

/** Cross-origin read — Preferences first, then localStorage fallback. */
export async function loadWorkspaceScope(): Promise<SavedWorkspaceScope> {
  try {
    const { value } = await Preferences.get({ key: PREFS_SCOPE_KEY });
    if (value) return parseScope(value);
  } catch {
    // Preferences unavailable (plain browser).
  }
  return loadWorkspaceScopeFromStorage();
}

/** Cross-origin write — always mirror to Preferences when available. */
export async function saveWorkspaceScope(scope: SavedWorkspaceScope): Promise<void> {
  saveWorkspaceScopeToStorage(scope);
  try {
    await Preferences.set({
      key: PREFS_SCOPE_KEY,
      value: scope === "personal" ? "personal" : String(scope),
    });
  } catch {
    // ignore
  }
}

/** After a full offline download, open the personal library by default. */
export async function resetWorkspaceScopeToPersonal(): Promise<void> {
  await saveWorkspaceScope("personal");
}
