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

/** Clears all device sync credentials (e.g. on sign-out). */
export async function clearStoredSyncCredentials(): Promise<void> {
  await Preferences.remove({ key: SYNC_TOKEN_KEY });
  await Preferences.remove({ key: USER_ID_KEY });
}
