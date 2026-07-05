import "server-only";

import { getAccessContext } from "@/lib/access";
import {
  getDecksForTeam,
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

export type { TeacherDeckQuota } from "@/lib/teacher-deck-quota";

export type TeacherDeckContext = {
  quota: TeacherDeckQuota;
  decks: DeckRow[];
  teamId: number | null;
  teamOwnerUserId: string | null;
};

function sortDecksNewestFirst(decks: DeckRow[]): DeckRow[] {
  return decks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function resolveEducationWorkspace(
  teams: Awaited<ReturnType<typeof getTeamsForTeamDashboard>>,
  userId: string,
) {
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
  decks: DeckRow[],
): TeacherDeckQuota {
  const limits = limitsForEducationTeamPlan(planSlug);
  const maxDecks = limits.maxDecksPerWorkspace;
  const deckCount = decks.length;
  const planLabel = EDUCATION_PLAN_LABELS[planSlug];

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

export async function loadTeacherDeckContext(
  userId: string,
): Promise<TeacherDeckContext> {
  const ctx = await getAccessContext();

  if (ctx.activeEducationTeamPlan != null) {
    const planSlug = ctx.activeEducationTeamPlan;
    const teams = await getTeamsForTeamDashboard(userId);
    const workspace = resolveEducationWorkspace(teams, userId);

    if (workspace) {
      const decks = await getDecksForTeam(workspace.id, workspace.ownerUserId);
      return {
        quota: workspaceQuota(planSlug, workspace, decks),
        decks: sortDecksNewestFirst(decks),
        teamId: workspace.id,
        teamOwnerUserId: workspace.ownerUserId,
      };
    }

    return {
      quota: workspaceQuota(planSlug, null, []),
      decks: [],
      teamId: null,
      teamOwnerUserId: userId,
    };
  }

  const teams = await getTeamsForTeamDashboard(userId);
  const memberWorkspace = resolveEducationWorkspace(teams, userId);

  if (memberWorkspace && isEducationTeamPlanId(memberWorkspace.planSlug)) {
    const planSlug = memberWorkspace.planSlug;
    const decks = await getDecksForTeam(
      memberWorkspace.id,
      memberWorkspace.ownerUserId,
    );
    return {
      quota: workspaceQuota(planSlug, memberWorkspace, decks),
      decks: sortDecksNewestFirst(decks),
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
