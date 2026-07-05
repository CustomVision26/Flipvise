import { db } from "@/db";
import {
  decks,
  planReconciliationSessions,
  teamMembers,
  teams,
  type PlanReconciliationSession,
} from "@/db/schema";
import { deleteDeck } from "@/db/queries/decks";
import { deleteTeamByOwner } from "@/db/queries/team-workspace-events";
import {
  deleteTeamMember,
  getDecksForTeamWithCardCount,
  getTeamsByOwner,
  listTeamMembers,
} from "@/db/queries/teams";
import { getPersonalDecksByUserWithCardCount } from "@/db/queries/decks";
import { getClerkUserDisplayNameById } from "@/lib/clerk-user-display";
import {
  limitsForReconciliationPlan,
  planTransitionTriggerKind,
  reconciliationModeForPlan,
} from "@/lib/plan-transition-limits";
import type {
  PlanReconciliationSnapshot,
  PlanReconciliationSubmitInput,
  ReconciliationResourceAction,
} from "@/lib/plan-reconciliation-types";
import { and, desc, eq } from "drizzle-orm";

function isActive(inactiveAt: Date | null | undefined): boolean {
  return inactiveAt == null;
}

function toIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export async function getPendingPlanReconciliationSession(
  userId: string,
): Promise<PlanReconciliationSession | null> {
  const rows = await db
    .select()
    .from(planReconciliationSessions)
    .where(
      and(
        eq(planReconciliationSessions.userId, userId),
        eq(planReconciliationSessions.status, "pending"),
      ),
    )
    .orderBy(desc(planReconciliationSessions.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function buildPlanReconciliationSnapshot(
  ownerUserId: string,
  targetPlanSlug: string,
  previousPlanSlug: string | null,
): Promise<PlanReconciliationSnapshot> {
  const limits = limitsForReconciliationPlan(targetPlanSlug);
  const mode = reconciliationModeForPlan(targetPlanSlug);

  const ownedTeams = await getTeamsByOwner(ownerUserId, { includeInactive: true });
  const teamsSnapshot = await Promise.all(
    ownedTeams.map(async (team) => {
      const members = await listTeamMembers(team.id, { includeInactive: true });
      const teamDecks = await getDecksForTeamWithCardCount(team.id, ownerUserId, {
        includeInactive: true,
      });
      const memberRows = await Promise.all(
        members.map(async (m) => ({
          userId: m.userId,
          displayName: await getClerkUserDisplayNameById(m.userId),
          role: m.role,
          createdAt: m.createdAt.toISOString(),
          inactiveAt: toIso(m.inactiveAt),
        })),
      );
      return {
        id: team.id,
        name: team.name,
        createdAt: team.createdAt.toISOString(),
        inactiveAt: toIso(team.inactiveAt),
        members: memberRows,
        decks: teamDecks.map((d) => ({
          id: d.id,
          name: d.name,
          cardCount: Number(d.cardCount ?? 0),
          createdByUserId: d.createdByUserId ?? null,
          createdAt: d.createdAt.toISOString(),
          inactiveAt: toIso(d.inactiveAt),
        })),
      };
    }),
  );

  const personalDeckRows = await getPersonalDecksByUserWithCardCount(ownerUserId, {
    includeInactive: true,
  });
  const personalDecks = personalDeckRows
    .filter((d) => d.teamId == null)
    .map((d) => ({
      id: d.id,
      name: d.name,
      cardCount: Number(d.cardCount ?? 0),
      createdByUserId: d.createdByUserId ?? null,
      createdAt: d.createdAt.toISOString(),
      inactiveAt: toIso(d.inactiveAt),
    }));

  const activeTeams = teamsSnapshot.filter((t) => isActive(t.inactiveAt ? new Date(t.inactiveAt) : null)).length;
  const activePersonalDecks = personalDecks.filter((d) => d.inactiveAt == null).length;

  return {
    targetPlanSlug,
    previousPlanSlug,
    triggerKind: planTransitionTriggerKind(previousPlanSlug, targetPlanSlug),
    limits,
    teams: mode === "team" ? teamsSnapshot : [],
    personalDecks,
    usage: {
      activeTeams,
      activePersonalDecks,
    },
  };
}

export function snapshotNeedsReconciliation(snapshot: PlanReconciliationSnapshot): boolean {
  const { limits, usage, teams, personalDecks } = snapshot;

  if (limits.mode === "team") {
    if (limits.maxTeams != null && usage.activeTeams > limits.maxTeams) return true;
    for (const team of teams) {
      if (team.inactiveAt != null) continue;
      const activeMembers = team.members.filter((m) => m.inactiveAt == null).length;
      const activeDecks = team.decks.filter((d) => d.inactiveAt == null).length;
      if (limits.maxMembersPerTeam != null && activeMembers > limits.maxMembersPerTeam) {
        return true;
      }
      if (limits.maxDecksPerWorkspace != null && activeDecks > limits.maxDecksPerWorkspace) {
        return true;
      }
    }
  }

  if (limits.maxPersonalDecks != null && usage.activePersonalDecks > limits.maxPersonalDecks) {
    return true;
  }

  return false;
}

export async function createPlanReconciliationSession(
  ownerUserId: string,
  targetPlanSlug: string,
  previousPlanSlug: string | null,
): Promise<PlanReconciliationSession | null> {
  const snapshot = await buildPlanReconciliationSnapshot(
    ownerUserId,
    targetPlanSlug,
    previousPlanSlug,
  );
  if (!snapshotNeedsReconciliation(snapshot)) return null;

  const [row] = await db
    .insert(planReconciliationSessions)
    .values({
      userId: ownerUserId,
      targetPlanSlug,
      previousPlanSlug,
      triggerKind: snapshot.triggerKind,
      status: "pending",
      snapshot,
    })
    .returning();
  return row ?? null;
}

function effectiveAction(
  currentInactiveAt: string | null,
  action: ReconciliationResourceAction,
): ReconciliationResourceAction {
  if (currentInactiveAt != null && action === "keep") return "inactive";
  return action;
}

function countActiveAfterChoices<T extends { inactiveAt: string | null }>(
  rows: T[],
  choices: Map<number | string, ReconciliationResourceAction>,
  idKey: (row: T) => number | string,
): number {
  let active = 0;
  for (const row of rows) {
    const action = effectiveAction(
      row.inactiveAt,
      choices.get(idKey(row)) ?? (row.inactiveAt ? "inactive" : "keep"),
    );
    if (action === "keep") active += 1;
  }
  return active;
}

export function validateReconciliationChoices(
  snapshot: PlanReconciliationSnapshot,
  input: PlanReconciliationSubmitInput,
): { ok: true } | { ok: false; message: string } {
  const { limits } = snapshot;

  if (limits.mode === "team" && input.teams) {
    const teamChoices = new Map(
      input.teams.map((t) => [t.teamId, t.action] as const),
    );
    const activeTeams = countActiveAfterChoices(
      snapshot.teams,
      teamChoices,
      (t) => t.id,
    );
    if (limits.maxTeams != null && activeTeams > limits.maxTeams) {
      return {
        ok: false,
        message: `Your ${limits.planLabel} plan allows ${limits.maxTeams} workspaces. Reduce active workspaces to continue.`,
      };
    }

    for (const team of snapshot.teams) {
      const teamChoice = input.teams.find((t) => t.teamId === team.id);
      const teamAction = effectiveAction(
        team.inactiveAt,
        teamChoice?.action ?? (team.inactiveAt ? "inactive" : "keep"),
      );
      if (teamAction !== "keep") continue;

      const memberChoices = new Map(
        (teamChoice?.members ?? []).map((m) => [m.memberUserId, m.action] as const),
      );
      const activeMembers = countActiveAfterChoices(
        team.members,
        memberChoices,
        (m) => m.userId,
      );
      if (
        limits.maxMembersPerTeam != null &&
        activeMembers > limits.maxMembersPerTeam
      ) {
        return {
          ok: false,
          message: `Workspace "${team.name}" exceeds the ${limits.maxMembersPerTeam} member limit for ${limits.planLabel}.`,
        };
      }

      const deckChoices = new Map(
        (teamChoice?.decks ?? []).map((d) => [d.deckId, d.action] as const),
      );
      const activeDecks = countActiveAfterChoices(
        team.decks,
        deckChoices,
        (d) => d.id,
      );
      if (
        limits.maxDecksPerWorkspace != null &&
        activeDecks > limits.maxDecksPerWorkspace
      ) {
        return {
          ok: false,
          message: `Workspace "${team.name}" exceeds the ${limits.maxDecksPerWorkspace} deck limit for ${limits.planLabel}.`,
        };
      }
    }
  }

  if (limits.maxPersonalDecks != null && input.personalDecks) {
    const deckChoices = new Map(
      input.personalDecks.map((d) => [d.deckId, d.action] as const),
    );
    const activePersonal = countActiveAfterChoices(
      snapshot.personalDecks,
      deckChoices,
      (d) => d.id,
    );
    if (activePersonal > limits.maxPersonalDecks) {
      return {
        ok: false,
        message: `Your ${limits.planLabel} plan allows ${limits.maxPersonalDecks} personal decks. Reduce active decks to continue.`,
      };
    }
  }

  return { ok: true };
}

async function applyResourceAction(
  kind: "team" | "member" | "deck",
  action: ReconciliationResourceAction,
  ids: { teamId?: number; memberUserId?: string; deckId?: number; ownerUserId: string },
): Promise<void> {
  if (action === "keep") return;
  const now = new Date();

  if (kind === "team" && ids.teamId != null) {
    if (action === "inactive") {
      await db
        .update(teams)
        .set({ inactiveAt: now })
        .where(
          and(eq(teams.id, ids.teamId), eq(teams.ownerUserId, ids.ownerUserId)),
        );
      return;
    }
    await deleteTeamByOwner(ids.ownerUserId, ids.teamId);
    return;
  }

  if (kind === "member" && ids.teamId != null && ids.memberUserId) {
    if (action === "inactive") {
      await db
        .update(teamMembers)
        .set({ inactiveAt: now, updatedAt: now })
        .where(
          and(
            eq(teamMembers.teamId, ids.teamId),
            eq(teamMembers.userId, ids.memberUserId),
          ),
        );
      return;
    }
    await deleteTeamMember(ids.teamId, ids.memberUserId);
    return;
  }

  if (kind === "deck" && ids.deckId != null) {
    if (action === "inactive") {
      await db
        .update(decks)
        .set({ inactiveAt: now, updatedAt: now })
        .where(eq(decks.id, ids.deckId));
      return;
    }
    await deleteDeck(ids.deckId, ids.ownerUserId);
  }
}

export async function applyPlanReconciliationChoices(
  ownerUserId: string,
  session: PlanReconciliationSession,
  input: PlanReconciliationSubmitInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const validation = validateReconciliationChoices(session.snapshot, input);
  if (!validation.ok) return validation;

  if (input.teams) {
    for (const teamChoice of input.teams) {
      const team = session.snapshot.teams.find((t) => t.id === teamChoice.teamId);
      if (!team) continue;

      await applyResourceAction("team", teamChoice.action, {
        teamId: teamChoice.teamId,
        ownerUserId,
      });

      if (teamChoice.action !== "keep") continue;

      for (const memberChoice of teamChoice.members) {
        await applyResourceAction("member", memberChoice.action, {
          teamId: teamChoice.teamId,
          memberUserId: memberChoice.memberUserId,
          ownerUserId,
        });
      }

      for (const deckChoice of teamChoice.decks) {
        await applyResourceAction("deck", deckChoice.action, {
          deckId: deckChoice.deckId,
          ownerUserId,
        });
      }
    }
  }

  if (input.personalDecks) {
    for (const deckChoice of input.personalDecks) {
      await applyResourceAction("deck", deckChoice.action, {
        deckId: deckChoice.deckId,
        ownerUserId,
      });
    }
  }

  await db
    .update(planReconciliationSessions)
    .set({ status: "completed", completedAt: new Date() })
    .where(
      and(
        eq(planReconciliationSessions.id, session.id),
        eq(planReconciliationSessions.userId, ownerUserId),
      ),
    );

  return { ok: true };
}

export async function maybeRequirePlanReconciliation(
  ownerUserId: string,
  targetPlanSlug: string | null,
  previousPlanSlug: string | null,
): Promise<void> {
  const existing = await getPendingPlanReconciliationSession(ownerUserId);
  if (existing) return;

  const slug = targetPlanSlug ?? "free";
  const snapshot = await buildPlanReconciliationSnapshot(
    ownerUserId,
    slug,
    previousPlanSlug,
  );
  if (!snapshotNeedsReconciliation(snapshot)) return;

  await db.insert(planReconciliationSessions).values({
    userId: ownerUserId,
    targetPlanSlug: slug,
    previousPlanSlug,
    triggerKind: snapshot.triggerKind,
    status: "pending",
    snapshot,
  });
}
