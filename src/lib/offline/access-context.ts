"use client";

/**
 * Cached plan limits + workspace roles for offline Study.
 * Written on each successful sync from `/api/sync` `context` payload.
 */

import { Preferences } from "@capacitor/preferences";
import type { AdminUserPlanAccessType } from "@/lib/admin-user-plan-label";

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
  /** Primary email when display name is unavailable offline. */
  ownerEmail?: string | null;
  /** True when the signed-in user is the subscriber owner of this workspace. */
  isSubscriberOwned?: boolean;
  /** Server deck ids for this workspace (from last sync — matches online Team Dashboard). */
  workspaceDeckServerIds?: number[];
};

export type OfflineAccessContext = {
  maxPersonalDecks: number;
  maxCardsPerDeck: number;
  workspaces: OfflineWorkspaceContext[];
  /** Label beside “Personal Dash” in the workspace switcher (e.g. Subscriber). */
  personalPlanLabel?: string;
  /** Billing tier for the account menu Plan row (e.g. Pro Plus). */
  personalAccountPlanLabel?: string;
  /** Plan source for the account menu Plan type row (Affiliate, Paid, Free, …). */
  personalPlanAccessType?: AdminUserPlanAccessType;
  /** Active team-tier personal subscription — gates Team Admin Dash and owned workspaces. */
  personalHasTeamTierPlan?: boolean;
  /** Signed-in user display name (for owned workspaces when owner label is missing). */
  viewerDisplayName?: string;
  viewerEmail?: string | null;
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
    const personalHasTeamTierPlan = parsed.personalHasTeamTierPlan ?? false;
    const workspaces = (parsed.workspaces ?? [])
      .filter((w) => {
        const owned = w.isSubscriberOwned ?? w.role === "owner";
        return personalHasTeamTierPlan || !owned;
      })
      .map((w) => ({
        ...w,
        teamMemberId: w.teamMemberId ?? 0,
        canAccessTeamAdmin:
          w.canAccessTeamAdmin ?? (w.role === "owner" || w.role === "team_admin"),
        ownerDisplayName: w.ownerDisplayName ?? "Subscriber",
        ownerEmail: w.ownerEmail ?? null,
        isSubscriberOwned: w.isSubscriberOwned ?? w.role === "owner",
        workspaceDeckServerIds: Array.isArray(w.workspaceDeckServerIds)
          ? w.workspaceDeckServerIds.filter((id) => Number.isFinite(id))
          : [],
      }));
    return {
      ...parsed,
      personalPlanLabel: parsed.personalPlanLabel ?? "Free",
      personalHasTeamTierPlan,
      workspaces,
    };
  } catch {
    return null;
  }
}

/** Owner line for team workspace UI — name first, then email; never bare “Subscriber” when we have data. */
export function formatOfflineWorkspaceOwnerLabel(
  workspace: OfflineWorkspaceContext,
  viewer?: Pick<OfflineAccessContext, "viewerDisplayName" | "viewerEmail">,
): string {
  if (workspace.isSubscriberOwned ?? workspace.role === "owner") {
    const selfName = viewer?.viewerDisplayName?.trim();
    if (selfName) return selfName;
    const selfEmail = viewer?.viewerEmail?.trim();
    if (selfEmail) return selfEmail;
  }

  const name = workspace.ownerDisplayName?.trim();
  if (name && name !== "Subscriber") return name;

  const email = workspace.ownerEmail?.trim();
  if (email) return email;

  return name || "Subscriber";
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
  const hasTeamTier = ctx.personalHasTeamTierPlan ?? false;
  const account = ctx.personalAccountPlanLabel?.trim();
  const accessType = ctx.personalPlanAccessType;
  const stored = ctx.personalPlanLabel?.trim();

  if (!hasTeamTier && stored) {
    const looksLikeTeamTierLabel =
      /team basic|team gold|platinum|enterprise/i.test(stored) ||
      stored.includes("(Affiliate)");
    if (looksLikeTeamTierLabel) {
      if (accessType === "Affiliate" && account) return `${account} (Affiliate)`;
      if (accessType === "Paid") return "Subscriber";
      if (accessType === "Complimentary") return "Complimentary";
      if (account) return account;
    }
  }

  if (stored && stored !== "Free") return stored;

  if (account && account !== "Free") {
    if (accessType === "Affiliate") return `${account} (Affiliate)`;
    if (accessType === "Paid") return "Subscriber";
    if (accessType === "Complimentary") return "Complimentary";
    return account;
  }

  if (ctx.maxPersonalDecks >= 15) return "Subscriber";
  if (ctx.maxPersonalDecks > 2) return "Subscriber";
  return "Free";
}

/** Account menu: billing tier + plan source (separate from workspace switcher label). */
export function resolveOfflineAccountPlanDisplay(ctx: OfflineAccessContext): {
  plan: string;
  planType: string;
} {
  const accountPlan = ctx.personalAccountPlanLabel?.trim();
  const accessType = ctx.personalPlanAccessType;
  if (accountPlan && accessType) {
    return { plan: accountPlan, planType: accessType };
  }

  if (ctx.maxPersonalDecks >= 15) {
    return { plan: "Pro Plus", planType: accessType ?? "Paid" };
  }
  if (ctx.maxPersonalDecks > 2) {
    return { plan: "Pro", planType: accessType ?? "Paid" };
  }

  const stored = ctx.personalPlanLabel?.trim() || "Free";
  const affiliateMatch = stored.match(/^(.+?)\s*\(Affiliate\)\s*$/i);
  if (affiliateMatch) {
    return { plan: affiliateMatch[1].trim(), planType: "Affiliate" };
  }
  if (stored === "Subscriber") {
    return { plan: accountPlan || "Pro", planType: "Paid" };
  }
  if (stored === "Complimentary" || stored === "SuperAdmin" || stored === "Co-Admin") {
    return {
      plan: accountPlan || "Pro Plus",
      planType: stored === "SuperAdmin" || stored === "Co-Admin" ? "Complimentary" : "Complimentary",
    };
  }
  return { plan: accountPlan || stored, planType: accessType ?? "Free" };
}
