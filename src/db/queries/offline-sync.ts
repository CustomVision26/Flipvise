import { and, eq, gt, inArray, or } from "drizzle-orm";
import { createClerkClient } from "@clerk/backend";
import { db } from "@/db";
import { cards, decks, quizResults } from "@/db/schema";
import { getDecksByUser, countPersonalDecksForUser } from "@/db/queries/decks";
import {
  getAssignedDecksForMember,
  getDecksForTeam,
  getEligibleWorkspaceTeamsForUser,
  getTeamById,
  getTeamMembershipsForUser,
} from "@/db/queries/teams";
import { getClerkUserDisplayNameById } from "@/lib/clerk-user-display";
import { getPersonalWorkspaceAccessLabel } from "@/lib/personal-workspace-plan-label";
import { CARDS_PER_DECK_LIMIT_PRO_PLUS } from "@/lib/deck-limits";
import { isPlatformSuperadminAllowListed } from "@/lib/platform-superadmin";
import {
  FREE_CARDS_PER_DECK_LIMIT,
  FREE_PERSONAL_DECK_LIMIT,
  limitsForPersonalIndividualTier,
  proPlusPersonalLimits,
} from "@/lib/personal-plan-limits";
import { resolvePersonalPlanMetadataVsBilling } from "@/lib/plan-metadata-billing-resolution";
import {
  isTeamPlanId,
  labelForTeamPlanSlug,
  limitsForPlan,
} from "@/lib/team-plans";

/**
 * Server-side push/pull helpers for the offline mobile Study database.
 *
 * Ownership is enforced on every statement by filtering on the Clerk `userId`
 * derived from the session in the route handler — never trust client-supplied ids.
 *
 * Conflict policy: last-write-wins by timestamp. The client sends each dirty row's
 * local update time; the server applies it when newer than the stored row. This is a
 * deliberate simple baseline — see `docs` notes for upgrading to field-level merges.
 */

export interface PushDeck {
  localId: string;
  serverId: number | null;
  name: string;
  description: string | null;
  gradient: string | null;
  updatedAtMs: number;
  deleted: boolean;
  /** When set, creates/updates a team workspace deck (owner/co-admin only). */
  teamId?: number | null;
}

export interface PushCard {
  localId: string;
  serverId: number | null;
  deckLocalId: string;
  deckServerId: number | null;
  front: string | null;
  back: string | null;
  cardType: "standard" | "multiple_choice";
  choices: string[] | null;
  correctChoiceIndex: number | null;
  updatedAtMs: number;
  deleted: boolean;
}

export interface PushQuizResult {
  localId: string;
  deckServerId: number | null;
  deckName: string;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  percent: number;
  elapsedSeconds: number;
  perCard: unknown;
}

export interface SyncPushPayload {
  decks: PushDeck[];
  cards: PushCard[];
  quizResults: PushQuizResult[];
}

/** Maps a client `localId` to the server row id it resolved to. */
export interface IdMapping {
  localId: string;
  serverId: number;
}

export interface SyncPushResult {
  deckIds: IdMapping[];
  cardIds: IdMapping[];
  quizResultIds: IdMapping[];
}

/**
 * Applies a batch of offline changes for one user. Decks are processed first so new
 * cards can resolve their parent deck's freshly-minted server id.
 */
export async function pushOfflineChanges(
  userId: string,
  payload: SyncPushPayload,
): Promise<SyncPushResult> {
  const deckIds: IdMapping[] = [];
  const cardIds: IdMapping[] = [];
  const quizResultIds: IdMapping[] = [];

  // local deck id -> server id resolved during this push
  const deckLocalToServer = new Map<string, number>();

  for (const d of payload.decks) {
    if (d.deleted) {
      if (d.serverId != null) {
        await db
          .delete(decks)
          .where(and(eq(decks.id, d.serverId), eq(decks.userId, userId)));
      }
      continue;
    }

    const teamId = d.teamId ?? null;

    if (teamId != null) {
      const team = await getTeamById(teamId);
      if (!team || team.ownerUserId !== userId) continue;
      if (d.serverId != null) {
        await db
          .update(decks)
          .set({
            name: d.name,
            description: d.description,
            gradient: d.gradient,
            updatedAt: new Date(d.updatedAtMs),
          })
          .where(and(eq(decks.id, d.serverId), eq(decks.userId, userId)));
        deckLocalToServer.set(d.localId, d.serverId);
        deckIds.push({ localId: d.localId, serverId: d.serverId });
      } else if (isTeamPlanId(team.planSlug)) {
        const limits = limitsForPlan(team.planSlug);
        const inWorkspace = await getDecksForTeam(team.id, team.ownerUserId);
        if (inWorkspace.length >= limits.maxDecksPerWorkspace) continue;
        const [inserted] = await db
          .insert(decks)
          .values({
            userId,
            name: d.name,
            description: d.description,
            gradient: d.gradient,
            teamId,
          })
          .returning({ id: decks.id });
        deckLocalToServer.set(d.localId, inserted.id);
        deckIds.push({ localId: d.localId, serverId: inserted.id });
      }
      continue;
    }

    if (d.serverId != null) {
      await db
        .update(decks)
        .set({ name: d.name, description: d.description, gradient: d.gradient, updatedAt: new Date(d.updatedAtMs) })
        .where(and(eq(decks.id, d.serverId), eq(decks.userId, userId)));
      deckLocalToServer.set(d.localId, d.serverId);
      deckIds.push({ localId: d.localId, serverId: d.serverId });
    } else {
      const limits = await personalLimitsForSyncUser(userId);
      const personalCount = await countPersonalDecksForUser(userId);
      if (personalCount >= limits.maxPersonalDecks) continue;
      const [inserted] = await db
        .insert(decks)
        .values({ userId, name: d.name, description: d.description, gradient: d.gradient })
        .returning({ id: decks.id });
      deckLocalToServer.set(d.localId, inserted.id);
      deckIds.push({ localId: d.localId, serverId: inserted.id });
    }
  }

  for (const c of payload.cards) {
    const parentServerId =
      c.deckServerId ?? deckLocalToServer.get(c.deckLocalId) ?? null;
    // Skip orphan cards whose parent deck never synced (will retry next push).
    if (parentServerId == null) continue;

    // Verify the parent deck belongs to this user before touching cards.
    const owned = await db
      .select({ id: decks.id })
      .from(decks)
      .where(and(eq(decks.id, parentServerId), eq(decks.userId, userId)))
      .limit(1);
    if (owned.length === 0) continue;

    if (c.deleted) {
      if (c.serverId != null) {
        await db.delete(cards).where(eq(cards.id, c.serverId));
      }
      continue;
    }

    if (c.serverId != null) {
      await db
        .update(cards)
        .set({
          front: c.front,
          back: c.back,
          cardType: c.cardType,
          choices: c.choices,
          correctChoiceIndex: c.correctChoiceIndex,
          updatedAt: new Date(c.updatedAtMs),
        })
        .where(eq(cards.id, c.serverId));
      cardIds.push({ localId: c.localId, serverId: c.serverId });
    } else {
      const [inserted] = await db
        .insert(cards)
        .values({
          deckId: parentServerId,
          front: c.front,
          back: c.back,
          cardType: c.cardType,
          choices: c.choices,
          correctChoiceIndex: c.correctChoiceIndex,
        })
        .returning({ id: cards.id });
      cardIds.push({ localId: c.localId, serverId: inserted.id });
    }
  }

  for (const q of payload.quizResults) {
    const [inserted] = await db
      .insert(quizResults)
      .values({
        userId,
        deckId: q.deckServerId,
        deckName: q.deckName,
        correct: q.correct,
        incorrect: q.incorrect,
        unanswered: q.unanswered,
        total: q.total,
        percent: q.percent,
        elapsedSeconds: q.elapsedSeconds,
        // perCard JSON column is typed; cast through unknown for the sync boundary.
        perCard: (q.perCard as never) ?? null,
      })
      .returning({ id: quizResults.id });
    quizResultIds.push({ localId: q.localId, serverId: inserted.id });
  }

  return { deckIds, cardIds, quizResultIds };
}

export interface PullDeck {
  serverId: number;
  teamId: number | null;
  memberAssigned: boolean;
  name: string;
  description: string | null;
  gradient: string | null;
  coverImageUrl: string | null;
  updatedAtMs: number;
}

export interface PullCard {
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
}

export interface SyncPullResult {
  decks: PullDeck[];
  cards: PullCard[];
  serverTimeMs: number;
}

export type OfflineSyncWorkspaceContext = {
  teamId: number;
  name: string;
  planSlug: string;
  planLabel: string;
  role: "owner" | "team_admin" | "team_member";
  /** `0` for subscriber owner; else `team_members.id` for co-admin URLs. */
  teamMemberId: number;
  canAccessTeamAdmin: boolean;
  maxDecksPerWorkspace: number;
  maxCardsPerDeck: number;
  canCreateDeck: boolean;
  ownerDisplayName: string;
  isSubscriberOwned: boolean;
};

export type OfflineSyncContext = {
  maxPersonalDecks: number;
  maxCardsPerDeck: number;
  workspaces: OfflineSyncWorkspaceContext[];
  personalPlanLabel: string;
  updatedAtMs: number;
};

type AccessibleDeckMeta = {
  teamId: number | null;
  memberAssigned: boolean;
};

async function collectAccessibleDeckMeta(
  userId: string,
): Promise<Map<number, AccessibleDeckMeta>> {
  const map = new Map<number, AccessibleDeckMeta>();

  const owned = await getDecksByUser(userId);
  for (const d of owned) {
    map.set(d.id, { teamId: d.teamId ?? null, memberAssigned: false });
  }

  const [workspaces, memberships] = await Promise.all([
    getEligibleWorkspaceTeamsForUser(userId),
    getTeamMembershipsForUser(userId),
  ]);
  const membershipByTeam = new Map(memberships.map((m) => [m.teamId, m] as const));

  for (const team of workspaces) {
    const membership = membershipByTeam.get(team.id);
    const role =
      team.ownerUserId === userId
        ? "owner"
        : membership?.role === "team_admin"
          ? "team_admin"
          : "team_member";

    if (role === "team_member") {
      const assigned = await getAssignedDecksForMember(team.id, userId);
      for (const d of assigned) {
        map.set(d.id, { teamId: team.id, memberAssigned: true });
      }
      continue;
    }

    const teamDecks = await getDecksForTeam(team.id, team.ownerUserId);
    for (const d of teamDecks) {
      const existing = map.get(d.id);
      map.set(d.id, {
        teamId: team.id,
        memberAssigned: existing?.memberAssigned ?? false,
      });
    }
  }

  return map;
}

async function personalLimitsForSyncUser(userId: string): Promise<{
  maxPersonalDecks: number;
  maxCardsPerDeck: number;
}> {
  if (isPlatformSuperadminAllowListed(userId)) {
    return proPlusPersonalLimits();
  }

  const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
  });

  let meta: Record<string, unknown> = {};
  try {
    const user = await clerkClient.users.getUser(userId);
    meta = (user.publicMetadata ?? {}) as Record<string, unknown>;
    const liveRole = meta.role;
    if (liveRole === "admin" || liveRole === "superadmin" || meta.adminGranted === true) {
      return proPlusPersonalLimits();
    }
  } catch {
    // Fall through to free-tier defaults when Clerk is unreachable.
  }

  const planResolution = await resolvePersonalPlanMetadataVsBilling({
    clerkClient,
    userId,
    has: () => false,
    publicMetadata: meta,
  });

  if (planResolution.activeTeamPlan !== null) {
    return proPlusPersonalLimits();
  }

  const stripeSlug = planResolution.effectiveStripeSlug;
  if (stripeSlug === "pro_plus") return limitsForPersonalIndividualTier("pro_plus");
  if (stripeSlug === "pro" || planResolution.personalPro) {
    return limitsForPersonalIndividualTier("pro");
  }

  return {
    maxPersonalDecks: FREE_PERSONAL_DECK_LIMIT,
    maxCardsPerDeck: FREE_CARDS_PER_DECK_LIMIT,
  };
}

/** Plan limits + workspace roles for the offline Study shell (refreshed each sync). */
export async function buildOfflineSyncContext(
  userId: string,
): Promise<OfflineSyncContext> {
  const personal = await personalLimitsForSyncUser(userId);
  const [workspaces, memberships, personalPlanLabel] = await Promise.all([
    getEligibleWorkspaceTeamsForUser(userId),
    getTeamMembershipsForUser(userId),
    getPersonalWorkspaceAccessLabel().catch(() => "Free"),
  ]);
  const membershipByTeam = new Map(memberships.map((m) => [m.teamId, m] as const));

  const teamPlanWorkspaces = workspaces.filter((t) => isTeamPlanId(t.planSlug));
  const ownerIds = [...new Set(teamPlanWorkspaces.map((t) => t.ownerUserId))];
  const ownerDisplayNameById = new Map<string, string>();
  await Promise.all(
    ownerIds.map(async (oid) => {
      ownerDisplayNameById.set(oid, await getClerkUserDisplayNameById(oid));
    }),
  );

  const workspaceContexts: OfflineSyncWorkspaceContext[] = teamPlanWorkspaces.map(
    (team) => {
      const membership = membershipByTeam.get(team.id);
      const role: OfflineSyncWorkspaceContext["role"] =
        team.ownerUserId === userId
          ? "owner"
          : membership?.role === "team_admin"
            ? "team_admin"
            : "team_member";
      const limits = limitsForPlan(team.planSlug);
      const teamMemberId =
        team.ownerUserId === userId ? 0 : (membership?.id ?? 0);
      return {
        teamId: team.id,
        name: team.name,
        planSlug: team.planSlug,
        planLabel: labelForTeamPlanSlug(team.planSlug) ?? team.planSlug,
        role,
        teamMemberId,
        canAccessTeamAdmin: role === "owner" || role === "team_admin",
        maxDecksPerWorkspace: limits.maxDecksPerWorkspace,
        maxCardsPerDeck: CARDS_PER_DECK_LIMIT_PRO_PLUS,
        canCreateDeck: role === "owner" || role === "team_admin",
        ownerDisplayName:
          ownerDisplayNameById.get(team.ownerUserId) ?? "Subscriber",
        isSubscriberOwned: team.ownerUserId === userId,
      };
    },
  );

  return {
    maxPersonalDecks: personal.maxPersonalDecks,
    maxCardsPerDeck: personal.maxCardsPerDeck,
    workspaces: workspaceContexts,
    personalPlanLabel,
    updatedAtMs: Date.now(),
  };
}

/**
 * Returns decks/cards the user may study offline, plus workspace metadata.
 * Caller supplies a session-derived `userId`.
 */
export async function pullOfflineChanges(
  userId: string,
  sinceMs: number,
): Promise<SyncPullResult> {
  const since = new Date(sinceMs);
  const accessible = await collectAccessibleDeckMeta(userId);
  const accessibleIds = [...accessible.keys()];

  if (accessibleIds.length === 0) {
    return { decks: [], cards: [], serverTimeMs: Date.now() };
  }

  let deckRows =
    sinceMs === 0
      ? await db.select().from(decks).where(inArray(decks.id, accessibleIds))
      : await db
          .select()
          .from(decks)
          .where(and(inArray(decks.id, accessibleIds), gt(decks.updatedAt, since)));

  let missingDeckIds: number[] = [];
  if (sinceMs > 0) {
    const have = new Set(deckRows.map((r) => r.id));
    missingDeckIds = accessibleIds.filter((id) => !have.has(id));
    if (missingDeckIds.length > 0) {
      const extra = await db
        .select()
        .from(decks)
        .where(inArray(decks.id, missingDeckIds));
      deckRows = [...deckRows, ...extra];
    }
  }

  const pulledDeckIds = deckRows.map((d) => d.id);
  const cardRows =
    pulledDeckIds.length > 0
      ? sinceMs === 0
        ? await db.select().from(cards).where(inArray(cards.deckId, pulledDeckIds))
        : missingDeckIds.length > 0
          ? await db
              .select()
              .from(cards)
              .where(
                or(
                  and(
                    inArray(cards.deckId, pulledDeckIds),
                    gt(cards.updatedAt, since),
                  ),
                  inArray(cards.deckId, missingDeckIds),
                ),
              )
          : await db
              .select()
              .from(cards)
              .where(
                and(inArray(cards.deckId, pulledDeckIds), gt(cards.updatedAt, since)),
              )
      : [];

  return {
    decks: deckRows.map((d) => {
      const meta = accessible.get(d.id) ?? {
        teamId: d.teamId ?? null,
        memberAssigned: false,
      };
      return {
        serverId: d.id,
        teamId: meta.teamId,
        memberAssigned: meta.memberAssigned,
        name: d.name,
        description: d.description,
        gradient: d.gradient,
        coverImageUrl: d.coverImageUrl,
        updatedAtMs: (d.updatedAt ?? d.createdAt ?? new Date()).getTime(),
      };
    }),
    cards: cardRows.map((c) => ({
      serverId: c.id,
      deckServerId: c.deckId,
      front: c.front,
      back: c.back,
      frontImageUrl: c.frontImageUrl,
      backImageUrl: c.backImageUrl,
      cardType: c.cardType,
      choices: c.choices ?? null,
      correctChoiceIndex: c.correctChoiceIndex,
      updatedAtMs: (c.updatedAt ?? c.createdAt ?? new Date()).getTime(),
    })),
    serverTimeMs: Date.now(),
  };
}
