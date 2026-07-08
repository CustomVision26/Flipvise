import "server-only";

import {
  getDecksForTeam,
  getTeamById,
  getTeamsForTeamDashboard,
} from "@/db/queries/teams";
import { getPersonalDecksByUser } from "@/db/queries/decks";
import { getAccessContext } from "@/lib/access";
import { resolveDeckCardCap } from "@/lib/deck-limits";
import {
  EDUCATION_PLAN_LABELS,
  isEducationTeamPlanId,
  limitsForEducationTeamPlan,
  type EducationTeamPlanId,
} from "@/lib/education-plans";
import { limitsForPersonalIndividualTier } from "@/lib/personal-plan-limits";

export function buildTeacherQuizDeckMetadata(input: {
  subject: string;
  topic: string;
  gradeLevel: string;
  difficultyLevel: string;
  savedLessonPlanId?: number;
}): { name: string; description: string } {
  const subject = input.subject.trim();
  const topic = input.topic.trim();
  const gradeLevel = input.gradeLevel.trim();
  const difficultyLevel = input.difficultyLevel.trim();

  const name = `${subject} — ${topic}`;
  const description = [
    topic,
    subject,
    gradeLevel ? `Grade ${gradeLevel}` : null,
    difficultyLevel ? `${difficultyLevel} difficulty` : null,
    "Teacher quiz deck",
    input.savedLessonPlanId != null
      ? `Lesson plan #${input.savedLessonPlanId}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return { name, description };
}

export function buildTeacherLessonDeckMetadata(input: {
  name?: string;
  subject: string;
  topic: string;
  gradeLevel: string;
  difficultyLevel: string;
}): { name: string; description: string } {
  const subject = input.subject.trim();
  const topic = input.topic.trim();
  const gradeLevel = input.gradeLevel.trim();
  const difficultyLevel = input.difficultyLevel.trim();
  const name =
    input.name?.trim() ||
    (subject && topic ? `${subject} — ${topic}` : subject || topic || "Lesson deck");
  const description = [
    topic,
    subject,
    gradeLevel ? `Grade ${gradeLevel}` : null,
    difficultyLevel ? `${difficultyLevel} difficulty` : null,
    "Teacher lesson plan deck",
  ]
    .filter(Boolean)
    .join(" · ");

  return { name, description };
}

export type TeacherQuizSaveTarget = {
  deckOwnerUserId: string;
  teamId: number | null;
  maxDecks: number;
  deckCount: number;
  maxCardsPerDeck: number;
  planLabel: string;
  scope: "workspace" | "personal";
  needsWorkspace: boolean;
};

function workspaceMaxCardsPerDeck(): number {
  return resolveDeckCardCap({
    teamTierProWorkspace: true,
    personalMaxCardsPerDeck: limitsForPersonalIndividualTier("pro_plus").maxCardsPerDeck,
  });
}

export async function resolveTeacherQuizSaveTarget(
  userId: string,
  explicitTeamId?: number | null,
): Promise<TeacherQuizSaveTarget> {
  const ctx = await getAccessContext();

  if (explicitTeamId != null && Number.isFinite(explicitTeamId)) {
    const team = await getTeamById(explicitTeamId);
    if (!team || !isEducationTeamPlanId(team.planSlug)) {
      throw new Error("Education workspace not found.");
    }

    const memberships = await getTeamsForTeamDashboard(userId);
    const canAccess =
      team.ownerUserId === userId ||
      memberships.some((membership) => membership.id === explicitTeamId);
    if (!canAccess) {
      throw new Error("You do not have access to this education workspace.");
    }

    const planSlug = team.planSlug as EducationTeamPlanId;
    const limits = limitsForEducationTeamPlan(planSlug);
    const workspaceDecks = await getDecksForTeam(team.id, team.ownerUserId);

    return {
      deckOwnerUserId: team.ownerUserId,
      teamId: team.id,
      maxDecks: limits.maxDecksPerWorkspace,
      deckCount: workspaceDecks.length,
      maxCardsPerDeck: workspaceMaxCardsPerDeck(),
      planLabel: EDUCATION_PLAN_LABELS[planSlug],
      scope: "workspace",
      needsWorkspace: false,
    };
  }

  if (ctx.activeEducationTeamPlan != null) {
    const teams = await getTeamsForTeamDashboard(userId);
    const workspace =
      teams.find(
        (team) =>
          team.ownerUserId === userId && isEducationTeamPlanId(team.planSlug),
      ) ?? teams.find((team) => isEducationTeamPlanId(team.planSlug)) ?? null;

    if (workspace) {
      const planSlug = workspace.planSlug as EducationTeamPlanId;
      const limits = limitsForEducationTeamPlan(planSlug);
      const workspaceDecks = await getDecksForTeam(workspace.id, workspace.ownerUserId);
      return {
        deckOwnerUserId: workspace.ownerUserId,
        teamId: workspace.id,
        maxDecks: limits.maxDecksPerWorkspace,
        deckCount: workspaceDecks.length,
        maxCardsPerDeck: workspaceMaxCardsPerDeck(),
        planLabel: EDUCATION_PLAN_LABELS[planSlug],
        scope: "workspace",
        needsWorkspace: false,
      };
    }

    return {
      deckOwnerUserId: userId,
      teamId: null,
      maxDecks: limitsForEducationTeamPlan(ctx.activeEducationTeamPlan).maxDecksPerWorkspace,
      deckCount: 0,
      maxCardsPerDeck: workspaceMaxCardsPerDeck(),
      planLabel: EDUCATION_PLAN_LABELS[ctx.activeEducationTeamPlan],
      scope: "workspace",
      needsWorkspace: true,
    };
  }

  const teams = await getTeamsForTeamDashboard(userId);
  const memberWorkspace =
    teams.find(
      (team) =>
        team.ownerUserId === userId && isEducationTeamPlanId(team.planSlug),
    ) ?? teams.find((team) => isEducationTeamPlanId(team.planSlug)) ?? null;

  if (memberWorkspace) {
    const planSlug = memberWorkspace.planSlug as EducationTeamPlanId;
    const limits = limitsForEducationTeamPlan(planSlug);
    const workspaceDecks = await getDecksForTeam(
      memberWorkspace.id,
      memberWorkspace.ownerUserId,
    );
    return {
      deckOwnerUserId: memberWorkspace.ownerUserId,
      teamId: memberWorkspace.id,
      maxDecks: limits.maxDecksPerWorkspace,
      deckCount: workspaceDecks.length,
      maxCardsPerDeck: workspaceMaxCardsPerDeck(),
      planLabel: EDUCATION_PLAN_LABELS[planSlug],
      scope: "workspace",
      needsWorkspace: false,
    };
  }

  const personalDecks = await getPersonalDecksByUser(userId);
  const isEducationPlus = ctx.effectivePlanSlug === "education_plus";
  const maxDecks = isEducationPlus
    ? limitsForPersonalIndividualTier("pro_plus").maxPersonalDecks
    : ctx.maxPersonalDecks;
  const maxCardsPerDeck =
    isEducationPlus
      ? limitsForPersonalIndividualTier("pro_plus").maxCardsPerDeck
      : ctx.maxCardsPerDeck;

  return {
    deckOwnerUserId: userId,
    teamId: null,
    maxDecks,
    deckCount: personalDecks.length,
    maxCardsPerDeck,
    planLabel:
      isEducationPlus && ctx.effectivePlanSlug === "education_plus"
        ? EDUCATION_PLAN_LABELS.education_plus
        : "Personal",
    scope: "personal",
    needsWorkspace: false,
  };
}
