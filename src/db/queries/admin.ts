import { db } from "@/db";
import {
  adminPrivilegeLogs,
  cards,
  decks,
  teamInvitations,
  teamMembers,
  teams,
} from "@/db/schema";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { TEAM_PLAN_LABELS, isTeamPlanId, type TeamPlanId } from "@/lib/team-plans";

function teamPlanLabelForAdmin(slug: string): string {
  return isTeamPlanId(slug) ? TEAM_PLAN_LABELS[slug as TeamPlanId] : slug;
}

export async function getAdminOverviewStats() {
  const [deckStats] = await db
    .select({ totalDecks: count(decks.id) })
    .from(decks);

  const [cardStats] = await db
    .select({ totalCards: count(cards.id) })
    .from(cards);

  return {
    totalDecks: deckStats?.totalDecks ?? 0,
    totalCards: cardStats?.totalCards ?? 0,
  };
}

export async function getDeckStatsByUser(): Promise<
  {
    userId: string;
    deckCount: number;
    cardCount: number;
    lastUpdated: Date | null;
  }[]
> {
  const rows = await db
    .select({
      userId: decks.userId,
      deckCount: count(decks.id),
      cardCount: sql<number>`cast(count(${cards.id}) as integer)`,
      // PostgreSQL GREATEST ignores NULLs, so if a user has no cards the deck
      // updatedAt is returned as the fallback.
      lastUpdated: sql<Date | null>`GREATEST(MAX(${decks.updatedAt}), MAX(${cards.updatedAt}))`,
    })
    .from(decks)
    .leftJoin(cards, eq(cards.deckId, decks.id))
    .groupBy(decks.userId);

  return rows.map((r) => ({
    userId: r.userId,
    deckCount: r.deckCount,
    cardCount: Number(r.cardCount),
    lastUpdated: r.lastUpdated ? new Date(r.lastUpdated) : null,
  }));
}

/**
 * Display label(s) for `teams.plan_slug` where the user is the workspace owner. Used
 * when Clerk public metadata is missing the billing plan id but the app DB is up to date.
 */
export async function getTeamOwnerPlanLabelsByUserIds(
  userIds: string[],
): Promise<Map<string, string | null>> {
  if (userIds.length === 0) return new Map();

  const rows = await db
    .select({ ownerUserId: teams.ownerUserId, planSlug: teams.planSlug })
    .from(teams)
    .where(inArray(teams.ownerUserId, userIds));

  const byUser = new Map<string, Set<string>>();
  for (const id of userIds) {
    byUser.set(id, new Set());
  }
  for (const r of rows) {
    byUser.get(r.ownerUserId)?.add(r.planSlug);
  }

  const out = new Map<string, string | null>();
  for (const id of userIds) {
    const set = byUser.get(id)!;
    if (set.size === 0) {
      out.set(id, null);
    } else {
      out.set(
        id,
        Array.from(set)
          .map(teamPlanLabelForAdmin)
          .sort((a, b) => a.localeCompare(b))
          .join(", "),
      );
    }
  }
  return out;
}

export type UserTeamPlanAdminRow = {
  label: string | null;
  /** True when the user is a team owner or `team_member` (not from a pending-only email invite). */
  hasActiveTeamAccess: boolean;
};

/**
 * **Associate plan (label):** workspace `plan_slug` for teams the user was **invited to
 * with an invitation in `accepted` status** (matched on primary email).
 *
 * **hasActiveTeamAccess:** `true` if the user is a team owner or active `team_member` —
 * used for admin “Plan = Pro” when combined with other signals (independent of label).
 */
export async function getUserTeamPlanAssociationsByUserIds(
  userIds: string[],
  /** Admin serializes every row’s `userId` + primary email so we can match `team_invitations.email`. */
  userIdPrimaryEmailPairs?: { userId: string; email: string | null }[],
): Promise<Map<string, UserTeamPlanAdminRow>> {
  if (userIds.length === 0) return new Map();

  const asOwner = await db
    .select({ userId: teams.ownerUserId })
    .from(teams)
    .where(inArray(teams.ownerUserId, userIds));

  const asMember = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(inArray(teamMembers.userId, userIds));

  const hasActiveTeamAccess = new Map<string, boolean>();
  for (const id of userIds) {
    hasActiveTeamAccess.set(id, false);
  }
  for (const row of asOwner) {
    hasActiveTeamAccess.set(row.userId, true);
  }
  for (const row of asMember) {
    hasActiveTeamAccess.set(row.userId, true);
  }

  const labelSlugsByUser = new Map<string, Set<string>>();
  for (const id of userIds) {
    labelSlugsByUser.set(id, new Set());
  }

  if (userIdPrimaryEmailPairs?.length) {
    const emailLower = userIdPrimaryEmailPairs
      .map((p) => p.email?.toLowerCase())
      .filter((e): e is string => Boolean(e));
    const unique = [...new Set(emailLower)];
    if (unique.length) {
      const acceptedRows = await db
        .select({ email: teamInvitations.email, planSlug: teams.planSlug })
        .from(teamInvitations)
        .innerJoin(teams, eq(teams.id, teamInvitations.teamId))
        .where(
          and(
            eq(teamInvitations.status, "accepted"),
            inArray(sql`lower(${teamInvitations.email})`, unique),
          ),
        );
      const emailToSlugs = new Map<string, Set<string>>();
      for (const row of acceptedRows) {
        const k = row.email.toLowerCase();
        if (!emailToSlugs.has(k)) {
          emailToSlugs.set(k, new Set());
        }
        emailToSlugs.get(k)!.add(row.planSlug);
      }
      for (const p of userIdPrimaryEmailPairs) {
        if (!p.email) continue;
        const sl = emailToSlugs.get(p.email.toLowerCase());
        if (sl) {
          const set = labelSlugsByUser.get(p.userId);
          if (set) {
            for (const s of sl) {
              set.add(s);
            }
          }
        }
      }
    }
  }

  const out = new Map<string, UserTeamPlanAdminRow>();
  for (const id of userIds) {
    const set = labelSlugsByUser.get(id)!;
    if (set.size === 0) {
      out.set(id, { label: null, hasActiveTeamAccess: hasActiveTeamAccess.get(id) ?? false });
    } else {
      const label = Array.from(set)
        .map(teamPlanLabelForAdmin)
        .sort((a, b) => a.localeCompare(b))
        .join(", ");
      out.set(id, { label, hasActiveTeamAccess: hasActiveTeamAccess.get(id) ?? false });
    }
  }
  return out;
}

export async function getAdminPrivilegeLogs(limit = 100) {
  return db
    .select()
    .from(adminPrivilegeLogs)
    .orderBy(desc(adminPrivilegeLogs.createdAt))
    .limit(limit);
}

export type AdminPrivilegeLogAction =
  | "granted"
  | "revoked"
  | "superadmin_granted"
  | "superadmin_revoked";

export async function logAdminPrivilegeChange(data: {
  targetUserId: string;
  targetUserName: string;
  grantedByUserId: string;
  grantedByName: string;
  action: AdminPrivilegeLogAction;
}) {
  return db.insert(adminPrivilegeLogs).values(data);
}
