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
  /** Resolved subscriber display name for the workspace switcher. */
  ownerDisplayName?: string;
  /** True when the signed-in user is the subscriber owner of this workspace. */
  isSubscriberOwned?: boolean;
};

export type OfflineAccessContext = {
  maxPersonalDecks: number;
  maxCardsPerDeck: number;
  workspaces: OfflineWorkspaceContext[];
  /** Label beside “Personal Dash” in the workspace switcher (e.g. Team Basic, Pro). */
  personalPlanLabel?: string;
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
      personalPlanLabel: parsed.personalPlanLabel ?? "Free",
      workspaces: (parsed.workspaces ?? []).map((w) => ({
        ...w,
        teamMemberId: w.teamMemberId ?? 0,
        canAccessTeamAdmin:
          w.canAccessTeamAdmin ?? (w.role === "owner" || w.role === "team_admin"),
        ownerDisplayName: w.ownerDisplayName ?? "Subscriber",
        isSubscriberOwned: w.isSubscriberOwned ?? w.role === "owner",
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

/** Personal plan label for the workspace switcher — uses sync payload with sensible fallbacks. */
export function resolveOfflinePersonalPlanLabel(
  ctx: OfflineAccessContext,
): string {
  const stored = ctx.personalPlanLabel?.trim();
  if (stored && stored !== "Free") return stored;

  const ownedTeam = ctx.workspaces.find((w) => w.role === "owner");
  if (ownedTeam) {
    return `${ownedTeam.planLabel} (Affiliate)`;
  }

  if (ctx.maxPersonalDecks >= 15) return "Pro Plus";
  if (ctx.maxPersonalDecks > 2) return "Pro";
  return stored || "Free";
}
