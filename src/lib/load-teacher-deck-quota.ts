import "server-only";

import { getAccessContext } from "@/lib/access";
import {
  getAssignedDecksForMember,
  getDecksForTeam,
  getEducationTeamAdminWorkspaceDecks,
  getMemberRecord,
  getTeamsForTeamDashboard,
} from "@/db/queries/teams";
import {
  getPersonalDecksByUser,
  type DeckRow,
} from "@/db/queries/decks";
import {
  EDUCATION_PLAN_LABELS,
  type EducationPlanId,
  type EducationTeamPlanId,
  isEducationTeamPlanId,
  limitsForEducationTeamPlan,
} from "@/lib/education-plans";
import { limitsForPersonalIndividualTier } from "@/lib/personal-plan-limits";
import { resolveDeckCardCap } from "@/lib/deck-limits";
import type { TeacherDeckQuota } from "@/lib/teacher-deck-quota";
import { resolveEducationTeamAdminCreateQuota } from "@/db/queries/education-team-admin-deck-quota";

export type { TeacherDeckQuota } from "@/lib/teacher-deck-quota";

export type TeacherDeckContext = {
  quota: TeacherDeckQuota;
  decks: DeckRow[];
  teamId: number | null;
  teamOwnerUserId: string | null;
};

type EducationWorkspaceTeam = {
  id: number;
  name: string;
  ownerUserId: string;
  planSlug: string;
};

function sortDecksNewestFirst(decks: DeckRow[]): DeckRow[] {
  return decks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function resolveEducationWorkspace(
  teams: Awaited<ReturnType<typeof getTeamsForTeamDashboard>>,
  userId: string,
  preferredTeamId?: number | null,
) {
  if (preferredTeamId != null) {
    const preferred = teams.find(
      (team) =>
        team.id === preferredTeamId && isEducationTeamPlanId(team.planSlug),
    );
    if (preferred) return preferred;
  }

  return (
    teams.find(
      (team) =>
        team.ownerUserId === userId && isEducationTeamPlanId(team.planSlug),
    ) ??
    teams.find((team) => isEducationTeamPlanId(team.planSlug)) ??
    null
  );
}

function workspaceMaxCardsPerDeck(): number {
  return resolveDeckCardCap({
    teamTierProWorkspace: true,
    personalMaxCardsPerDeck: limitsForPersonalIndividualTier("pro_plus").maxCardsPerDeck,
  });
}

function personalMaxCardsPerDeck(
  ctx: Awaited<ReturnType<typeof getAccessContext>>,
  planSlug: EducationPlanId | null,
): number {
  if (planSlug === "education_plus") {
    return limitsForPersonalIndividualTier("pro_plus").maxCardsPerDeck;
  }
  return ctx.maxCardsPerDeck;
}

function workspaceQuota(
  planSlug: EducationTeamPlanId,
  workspace: { id: number; name: string; ownerUserId: string } | null,
  /** Full workspace deck set — used for quota / at-limit (not the picker subset). */
  quotaDecks: DeckRow[],
  /** When set, team-admin create quota (created-by count vs owner cap). */
  teamAdminCreate?: { createdCount: number; maxCreateDecks: number } | null,
): TeacherDeckQuota {
  const limits = limitsForEducationTeamPlan(planSlug);
  const workspaceMax = limits.maxDecksPerWorkspace;
  const planLabel = EDUCATION_PLAN_LABELS[planSlug];

  if (teamAdminCreate != null) {
    const maxDecks = Math.min(teamAdminCreate.maxCreateDecks, workspaceMax);
    const deckCount = teamAdminCreate.createdCount;
    return {
      deckCount,
      maxDecks,
      maxCardsPerDeck: workspaceMaxCardsPerDeck(),
      scope: "workspace",
      workspaceName: workspace?.name ?? null,
      planSlug,
      planLabel,
      needsWorkspace: workspace == null,
      atLimit:
        maxDecks > 0 &&
        (deckCount >= maxDecks || quotaDecks.length >= workspaceMax),
    };
  }

  const maxDecks = workspaceMax;
  const deckCount = quotaDecks.length;

  return {
    deckCount,
    maxDecks,
    maxCardsPerDeck: workspaceMaxCardsPerDeck(),
    scope: "workspace",
    workspaceName: workspace?.name ?? null,
    planSlug,
    planLabel,
    needsWorkspace: workspace == null,
    atLimit: maxDecks > 0 && deckCount >= maxDecks,
  };
}

function personalQuota(
  planSlug: EducationPlanId | null,
  deckCount: number,
  maxDecks: number,
  maxCardsPerDeck: number,
): TeacherDeckQuota {
  const planLabel =
    planSlug != null ? EDUCATION_PLAN_LABELS[planSlug] : "Personal";

  return {
    deckCount,
    maxDecks,
    maxCardsPerDeck,
    scope: "personal",
    workspaceName: null,
    planSlug,
    planLabel,
    needsWorkspace: false,
    atLimit: maxDecks > 0 && deckCount >= maxDecks,
  };
}

/**
 * Decks shown in teacher tool pickers for a workspace.
 * Owners see the full workspace library; education team admins see decks they
 * created plus decks assigned to them (Team Dashboard parity); other members
 * see assigned decks only.
 */
async function loadPickerDecksForEducationWorkspace(
  userId: string,
  workspace: EducationWorkspaceTeam,
): Promise<{
  pickerDecks: DeckRow[];
  quotaDecks: DeckRow[];
  teamAdminCreate: { createdCount: number; maxCreateDecks: number } | null;
}> {
  const quotaDecks = await getDecksForTeam(workspace.id, workspace.ownerUserId);

  if (workspace.ownerUserId === userId) {
    return { pickerDecks: quotaDecks, quotaDecks, teamAdminCreate: null };
  }

  if (isEducationTeamPlanId(workspace.planSlug)) {
    const member = await getMemberRecord(workspace.id, userId);
    if (member?.role === "team_admin") {
      const [pickerDecks, createQuota] = await Promise.all([
        getEducationTeamAdminWorkspaceDecks(
          workspace.id,
          workspace.ownerUserId,
          userId,
        ),
        resolveEducationTeamAdminCreateQuota(
          workspace.id,
          workspace.ownerUserId,
          userId,
          workspace.planSlug,
        ),
      ]);
      return {
        pickerDecks,
        quotaDecks,
        teamAdminCreate: {
          createdCount: createQuota.createdCount,
          maxCreateDecks: createQuota.maxCreateDecks,
        },
      };
    }
  }

  const assigned = await getAssignedDecksForMember(workspace.id, userId);
  return { pickerDecks: assigned, quotaDecks, teamAdminCreate: null };
}

/**
 * @param preferredTeamId — teacher workspace from the URL/cookie. When set, deck
 *   pickers resolve that workspace (including assigned team decks) instead of
 *   guessing via the first owned education team.
 */
export async function loadTeacherDeckContext(
  userId: string,
  preferredTeamId?: number | null,
): Promise<TeacherDeckContext> {
  const ctx = await getAccessContext();
  const teams = await getTeamsForTeamDashboard(userId);

  if (ctx.activeEducationTeamPlan != null) {
    const planSlug = ctx.activeEducationTeamPlan;
    const workspace = resolveEducationWorkspace(teams, userId, preferredTeamId);

    if (workspace) {
      const { pickerDecks, quotaDecks, teamAdminCreate } =
        await loadPickerDecksForEducationWorkspace(userId, workspace);
      return {
        quota: workspaceQuota(planSlug, workspace, quotaDecks, teamAdminCreate),
        decks: sortDecksNewestFirst(pickerDecks),
        teamId: workspace.id,
        teamOwnerUserId: workspace.ownerUserId,
      };
    }

    return {
      quota: workspaceQuota(planSlug, null, [], null),
      decks: [],
      teamId: null,
      teamOwnerUserId: userId,
    };
  }

  const memberWorkspace = resolveEducationWorkspace(
    teams,
    userId,
    preferredTeamId,
  );

  if (memberWorkspace && isEducationTeamPlanId(memberWorkspace.planSlug)) {
    const planSlug = memberWorkspace.planSlug;
    const { pickerDecks, quotaDecks, teamAdminCreate } =
      await loadPickerDecksForEducationWorkspace(userId, memberWorkspace);
    return {
      quota: workspaceQuota(planSlug, memberWorkspace, quotaDecks, teamAdminCreate),
      decks: sortDecksNewestFirst(pickerDecks),
      teamId: memberWorkspace.id,
      teamOwnerUserId: memberWorkspace.ownerUserId,
    };
  }

  const decks = await getPersonalDecksByUser(userId);
  const isEducationPlus = ctx.effectivePlanSlug === "education_plus";
  const maxDecks = isEducationPlus
    ? limitsForPersonalIndividualTier("pro_plus").maxPersonalDecks
    : ctx.maxPersonalDecks;
  const maxCardsPerDeck = personalMaxCardsPerDeck(
    ctx,
    isEducationPlus ? "education_plus" : null,
  );

  return {
    quota: personalQuota(
      isEducationPlus ? "education_plus" : null,
      decks.length,
      maxDecks,
      maxCardsPerDeck,
    ),
    decks,
    teamId: null,
    teamOwnerUserId: null,
  };
}
