"use client";

/**
 * Cached plan limits + workspace roles for offline Study.
 * Written on each successful sync from `/api/sync` `context` payload.
 */

import { Preferences } from "@capacitor/preferences";

const ACCESS_CONTEXT_KEY = "flipvise.offline.accessContext";

export type OfflineWorkspaceRole = "owner" | "team_admin" | "team_member";

export type OfflineWorkspaceContext = {
  teamId: number;
  name: string;
  planSlug: string;
  planLabel: string;
  role: OfflineWorkspaceRole;
  /** `0` for subscriber owner; else `team_members.id` for co-admin team-admin URLs. */
  teamMemberId: number;
  canAccessTeamAdmin: boolean;
  maxDecksPerWorkspace: number;
  maxCardsPerDeck: number;
  /** Owner or co-admin may add decks to the workspace; plain members may not. */
  canCreateDeck: boolean;
};

export type OfflineAccessContext = {
  maxPersonalDecks: number;
  maxCardsPerDeck: number;
  workspaces: OfflineWorkspaceContext[];
  updatedAtMs: number;
};

export async function setOfflineAccessContext(
  context: OfflineAccessContext,
): Promise<void> {
  await Preferences.set({
    key: ACCESS_CONTEXT_KEY,
    value: JSON.stringify(context),
  });
}

export async function getOfflineAccessContext(): Promise<OfflineAccessContext | null> {
  const { value } = await Preferences.get({ key: ACCESS_CONTEXT_KEY });
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as OfflineAccessContext;
    return {
      ...parsed,
      workspaces: (parsed.workspaces ?? []).map((w) => ({
        ...w,
        teamMemberId: w.teamMemberId ?? 0,
        canAccessTeamAdmin:
          w.canAccessTeamAdmin ?? (w.role === "owner" || w.role === "team_admin"),
      })),
    };
  } catch {
    return null;
  }
}

export function defaultOfflineAccessContext(): OfflineAccessContext {
  return {
    maxPersonalDecks: 2,
    maxCardsPerDeck: 5,
    workspaces: [],
    updatedAtMs: 0,
  };
}
