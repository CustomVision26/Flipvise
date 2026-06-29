"use client";

/**
 * Persists the Clerk user id of the last authenticated session into native storage
 * (Capacitor Preferences). The bundled offline Study app has no auth context of its
 * own, so it reads this value to know whose locally-cached decks to load. It is written
 * by the authenticated live site during "Make available offline".
 */

import { Preferences } from "@capacitor/preferences";

const USER_ID_KEY = "flipvise.offline.userId";
const SYNC_TOKEN_KEY = "flipvise.offline.syncToken";
const API_BASE_URL_KEY = "flipvise.offline.apiBaseUrl";
/** Last in-app WebView navigation target (live site handoff) for error.html retry. */
const LAST_NAVIGATION_URL_KEY = "flipvise.offline.lastNavigationUrl";
/** Stashed `/api/sync` pull payload when SQLite is unavailable on the live dashboard page. */
const PENDING_PULL_KEY = "flipvise.offline.pendingPull";
const PENDING_PULL_USER_KEY = "flipvise.offline.pendingPullUserId";
/** Set by the bundled offline shell so the live site can detect the native app. */
const NATIVE_APP_FLAG_KEY = "flipvise.nativeApp";
/** Theme (light/dark mode + interface colors) carried from the live dashboard. */
const THEME_PREFS_KEY = "flipvise.offline.theme";
/** Whether the app requires the device security credential (biometric/PIN) to open. */
const APP_LOCK_KEY = "flipvise.offline.appLock";

/** Enables/disables the device-credential app lock for the offline shell. */
export async function setAppLockEnabled(enabled: boolean): Promise<void> {
  await Preferences.set({ key: APP_LOCK_KEY, value: enabled ? "1" : "0" });
}

export async function getAppLockEnabled(): Promise<boolean> {
  const { value } = await Preferences.get({ key: APP_LOCK_KEY });
  return value === "1";
}

/**
 * Snapshot of the live dashboard's resolved theme so the bundled offline shell
 * can match the user's light/dark mode and interface (accent/background) colors.
 * Colors are stored as raw computed CSS values (e.g. `oklch(...)`).
 */
export type OfflineThemePrefs = {
  mode: "light" | "dark";
  /** Pro/free interface preset id (`neutral` = default shell palette). */
  interfaceId?: string | null;
  background: string | null;
  foreground: string | null;
  card: string | null;
  border: string | null;
  mutedForeground: string | null;
  primary: string | null;
  primaryForeground: string | null;
};

export async function setOfflineThemePrefs(
  prefs: OfflineThemePrefs,
): Promise<void> {
  await Preferences.set({ key: THEME_PREFS_KEY, value: JSON.stringify(prefs) });
}

export async function getOfflineThemePrefs(): Promise<OfflineThemePrefs | null> {
  const { value } = await Preferences.get({ key: THEME_PREFS_KEY });
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<OfflineThemePrefs>;
    if (parsed.mode !== "light" && parsed.mode !== "dark") return null;
    return {
      mode: parsed.mode,
      interfaceId: parsed.interfaceId ?? null,
      background: parsed.background ?? null,
      foreground: parsed.foreground ?? null,
      card: parsed.card ?? null,
      border: parsed.border ?? null,
      mutedForeground: parsed.mutedForeground ?? null,
      primary: parsed.primary ?? null,
      primaryForeground: parsed.primaryForeground ?? null,
    };
  } catch {
    return null;
  }
}

/** Marks this install as the Flipvise native app (survives navigation to the live site). */
export async function setNativeAppFlag(): Promise<void> {
  await Preferences.set({ key: NATIVE_APP_FLAG_KEY, value: "1" });
}

export async function getNativeAppFlag(): Promise<boolean> {
  const { value } = await Preferences.get({ key: NATIVE_APP_FLAG_KEY });
  return value === "1";
}

export async function setStoredUserId(userId: string): Promise<void> {
  await Preferences.set({ key: USER_ID_KEY, value: userId });
}

export async function getStoredUserId(): Promise<string | null> {
  const { value } = await Preferences.get({ key: USER_ID_KEY });
  return value ?? null;
}

export async function clearStoredUserId(): Promise<void> {
  await Preferences.remove({ key: USER_ID_KEY });
}

/** Device sync token (Bearer) used by the bundled app to reach /api/sync. */
export async function setStoredSyncToken(token: string): Promise<void> {
  await Preferences.set({ key: SYNC_TOKEN_KEY, value: token });
}

export async function getStoredSyncToken(): Promise<string | null> {
  const { value } = await Preferences.get({ key: SYNC_TOKEN_KEY });
  return value ?? null;
}

/** Live origin the bundled app syncs against (e.g. https://flipvise-sjgw.onrender.com). */
export async function setStoredApiBaseUrl(url: string): Promise<void> {
  await Preferences.set({ key: API_BASE_URL_KEY, value: url });
}

export async function getStoredApiBaseUrl(): Promise<string | null> {
  const { value } = await Preferences.get({ key: API_BASE_URL_KEY });
  return value ?? null;
}

export async function setLastNavigationUrl(url: string): Promise<void> {
  await Preferences.set({ key: LAST_NAVIGATION_URL_KEY, value: url });
}

export async function getLastNavigationUrl(): Promise<string | null> {
  const { value } = await Preferences.get({ key: LAST_NAVIGATION_URL_KEY });
  return value ?? null;
}

/** Queues a sync pull for the offline shell when the live site cannot open SQLite. */
export async function setPendingOfflinePull(
  userId: string,
  payloadJson: string,
): Promise<void> {
  await Preferences.set({ key: PENDING_PULL_USER_KEY, value: userId });
  await Preferences.set({ key: PENDING_PULL_KEY, value: payloadJson });
}

export async function getPendingOfflinePull(): Promise<{
  userId: string;
  payloadJson: string;
} | null> {
  const [{ value: userId }, { value: payloadJson }] = await Promise.all([
    Preferences.get({ key: PENDING_PULL_USER_KEY }),
    Preferences.get({ key: PENDING_PULL_KEY }),
  ]);
  if (!userId || !payloadJson) return null;
  return { userId, payloadJson };
}

export async function clearPendingOfflinePull(): Promise<void> {
  await Preferences.remove({ key: PENDING_PULL_KEY });
  await Preferences.remove({ key: PENDING_PULL_USER_KEY });
}

/** Clears all device sync credentials (e.g. on sign-out). */
export async function clearStoredSyncCredentials(): Promise<void> {
  await Preferences.remove({ key: SYNC_TOKEN_KEY });
  await Preferences.remove({ key: USER_ID_KEY });
  await clearPendingOfflinePull();
}
