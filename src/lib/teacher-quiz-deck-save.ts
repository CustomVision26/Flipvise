import "server-only";

import {
  getDecksForTeam,
  getMemberRecord,
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
import { resolveEducationTeamAdminCreateQuota } from "@/db/queries/education-team-admin-deck-quota";

import { db } from "@/db";
import { decks } from "@/db/schema";
import { getDeckRowById } from "@/db/queries/decks";
import {
  findDecksTaggedWithLessonPlanForOwner,
  resolveSavedLessonPlanForViewer,
} from "@/db/queries/saved-lesson-plans";
import { and, eq, isNull } from "drizzle-orm";
import { lessonPlanDeckDescriptionMarker } from "@/lib/lesson-plan-deck-marker";
import { type LessonPlanDayScope } from "@/lib/lesson-plan-day-scope";
import { canEditDeckContent, getDeckWithViewerAccess } from "@/lib/team-deck-access";
import {
  buildLessonPlanScopedDeckName,
  buildShortTeacherDeckName,
  formatCompactDayScopeLabel,
  formatLessonScopeDescriptionSegment,
  parseLessonScopeLabelFromDeckName,
  parseLessonScopeLabelFromDescription,
  stripLessonPlanScopedDeckSuffix,
} from "@/lib/teacher-generation-titles";

export function buildTeacherQuizDeckMetadata(input: {
  subject: string;
  topic: string;
  gradeLevel: string;
  difficultyLevel: string;
  savedLessonPlanId?: number;
  dayScope?: LessonPlanDayScope | null;
  /** When set, used as the deck name instead of the short subject/topic name. */
  nameOverride?: string | null;
}): { name: string; description: string } {
  const subject = input.subject.trim();
  const topic = input.topic.trim();
  const gradeLevel = input.gradeLevel.trim();
  const difficultyLevel = input.difficultyLevel.trim();
  const fromLessonPlan = input.savedLessonPlanId != null;

  const name =
    input.nameOverride?.trim() || buildShortTeacherDeckName(subject, topic);
  const description = [
    topic && topic !== subject ? topic : null,
    subject && subject !== name ? subject : null,
    gradeLevel ? `Grade ${gradeLevel}` : null,
    difficultyLevel ? `${difficultyLevel} difficulty` : null,
    "Teacher quiz deck",
    fromLessonPlan && input.dayScope != null
      ? formatLessonScopeDescriptionSegment(input.dayScope)
      : null,
    fromLessonPlan
      ? lessonPlanDeckDescriptionMarker(input.savedLessonPlanId!)
      : null,
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

export type ResolvedLessonPlanQuizDeckTarget =
  | {
      mode: "append";
      deckId: number;
      deckName: string;
    }
  | {
      mode: "create";
      name: string;
      description: string;
    };

function normalizeNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Resolve where quiz cards should be saved for a lesson-plan generation:
 * - All Days → append to / create `{base} LP All Days` (never the main lesson deck or a Day N deck)
 * - Day N → append to `{base} LP Day N` if it exists, else create it
 * - No lesson plan → create a new short-named deck
 */
export async function resolveLessonPlanQuizDeckSaveTarget(input: {
  viewerUserId: string;
  saveTarget: TeacherQuizSaveTarget;
  savedLessonPlanId?: number;
  dayScope?: LessonPlanDayScope | null;
  subject: string;
  topic: string;
  gradeLevel: string;
  difficultyLevel: string;
  teamId?: number | null;
}): Promise<ResolvedLessonPlanQuizDeckTarget> {
  const fallbackMeta = buildTeacherQuizDeckMetadata({
    subject: input.subject,
    topic: input.topic,
    gradeLevel: input.gradeLevel,
    difficultyLevel: input.difficultyLevel,
    savedLessonPlanId: input.savedLessonPlanId,
    dayScope: input.savedLessonPlanId != null ? input.dayScope : undefined,
  });

  if (input.savedLessonPlanId == null) {
    return { mode: "create", name: fallbackMeta.name, description: fallbackMeta.description };
  }

  const plan = await resolveSavedLessonPlanForViewer(
    input.viewerUserId,
    input.savedLessonPlanId,
    input.teamId,
  );
  if (!plan) {
    throw new Error("Saved lesson plan not found.");
  }

  let mainDeck =
    plan.deckId != null ? await getDeckRowById(plan.deckId) : null;
  if (mainDeck && mainDeck.userId !== input.saveTarget.deckOwnerUserId) {
    mainDeck = null;
  }
  if (mainDeck) {
    const bundle = await getDeckWithViewerAccess(mainDeck.id, input.viewerUserId);
    if (!bundle || !canEditDeckContent(bundle.access)) {
      mainDeck = null;
    }
  }

  const baseName =
    (mainDeck?.name ? stripLessonPlanScopedDeckSuffix(mainDeck.name) : "") ||
    plan.sourceDeckName?.trim() ||
    buildShortTeacherDeckName(input.subject, input.topic);

  // Treat missing scope as All Days for naming, but always use a dedicated
  // `LP All Days` deck — never append into the linked main lesson deck.
  const dayScope: LessonPlanDayScope = input.dayScope ?? "all";
  const scopedName = buildLessonPlanScopedDeckName(baseName, dayScope);
  const existing = await findScopedLessonPlanDeck({
    lessonPlanId: input.savedLessonPlanId,
    ownerUserId: input.saveTarget.deckOwnerUserId,
    teamId: input.saveTarget.teamId,
    scopedName,
    dayScope,
    viewerUserId: input.viewerUserId,
    /** Linked lesson deck must stay separate from All Days / Day N quiz decks. */
    excludeDeckId: mainDeck?.id ?? null,
  });
  if (existing) {
    return {
      mode: "append",
      deckId: existing.id,
      deckName: existing.name,
    };
  }

  const meta = buildTeacherQuizDeckMetadata({
    subject: input.subject,
    topic: input.topic,
    gradeLevel: input.gradeLevel,
    difficultyLevel: input.difficultyLevel,
    savedLessonPlanId: input.savedLessonPlanId,
    dayScope,
    nameOverride: scopedName,
  });
  return { mode: "create", name: meta.name, description: meta.description };
}

async function findScopedLessonPlanDeck(input: {
  lessonPlanId: number;
  ownerUserId: string;
  teamId: number | null;
  scopedName: string;
  dayScope: LessonPlanDayScope;
  viewerUserId: string;
  excludeDeckId?: number | null;
}): Promise<{ id: number; name: string } | null> {
  const scopeLabel = formatCompactDayScopeLabel(input.dayScope);
  const expectedScopeKey = scopeLabel ? normalizeNameKey(scopeLabel) : null;
  const tagged = (
    await findDecksTaggedWithLessonPlanForOwner(
      input.lessonPlanId,
      input.ownerUserId,
      input.teamId,
    )
  ).filter((deck) => deck.id !== input.excludeDeckId);

  const deckScopeKey = (deck: {
    name: string;
    description: string | null;
  }): string | null => {
    const fromDesc = parseLessonScopeLabelFromDescription(deck.description);
    if (fromDesc) return normalizeNameKey(fromDesc);
    const fromName = parseLessonScopeLabelFromDeckName(deck.name);
    if (fromName) return normalizeNameKey(fromName);
    return null;
  };

  const nameKey = normalizeNameKey(input.scopedName);
  const byName = tagged.find((deck) => {
    if (normalizeNameKey(deck.name) !== nameKey) return false;
    // Require matching day scope when the deck already declares one, so
    // All Days never lands on an `LP Day N` deck (and vice versa).
    const scopeKey = deckScopeKey(deck);
    return scopeKey == null || scopeKey === expectedScopeKey;
  });
  if (byName) {
    const bundle = await getDeckWithViewerAccess(byName.id, input.viewerUserId);
    if (bundle && canEditDeckContent(bundle.access)) {
      return { id: byName.id, name: byName.name };
    }
  }

  if (expectedScopeKey) {
    const byScope = tagged.find(
      (deck) => deckScopeKey(deck) === expectedScopeKey,
    );
    if (byScope) {
      const bundle = await getDeckWithViewerAccess(byScope.id, input.viewerUserId);
      if (bundle && canEditDeckContent(bundle.access)) {
        return { id: byScope.id, name: byScope.name };
      }
    }
  }

  // Fallback: exact name match among owner decks (even if description marker is missing).
  const ownership =
    input.teamId != null
      ? and(eq(decks.userId, input.ownerUserId), eq(decks.teamId, input.teamId))
      : and(eq(decks.userId, input.ownerUserId), isNull(decks.teamId));
  const [byExactName] = await db
    .select({ id: decks.id, name: decks.name, description: decks.description })
    .from(decks)
    .where(and(ownership, eq(decks.name, input.scopedName)))
    .limit(1);
  if (
    byExactName &&
    byExactName.id !== input.excludeDeckId
  ) {
    const scopeKey = deckScopeKey(byExactName);
    if (scopeKey == null || scopeKey === expectedScopeKey) {
      const bundle = await getDeckWithViewerAccess(
        byExactName.id,
        input.viewerUserId,
      );
      if (bundle && canEditDeckContent(bundle.access)) {
        return { id: byExactName.id, name: byExactName.name };
      }
    }
  }

  return null;
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
    buildShortTeacherDeckName(subject, topic) ||
    "Lesson deck";
  const description = [
    topic && topic !== name ? topic : null,
    subject && subject !== name ? subject : null,
    gradeLevel ? `Grade ${gradeLevel}` : null,
    difficultyLevel ? `${difficultyLevel} difficulty` : null,
    "Teacher lesson plan deck",
  ]
    .filter(Boolean)
    .join(" · ");

  return { name, description };
}

function workspaceMaxCardsPerDeck(): number {
  return resolveDeckCardCap({
    teamTierProWorkspace: true,
    personalMaxCardsPerDeck: limitsForPersonalIndividualTier("pro_plus").maxCardsPerDeck,
  });
}

async function resolveWorkspaceSaveQuota(
  userId: string,
  team: { id: number; ownerUserId: string; planSlug: string },
): Promise<{ maxDecks: number; deckCount: number }> {
  const planSlug = team.planSlug as EducationTeamPlanId;
  const limits = limitsForEducationTeamPlan(planSlug);
  const workspaceDecks = await getDecksForTeam(team.id, team.ownerUserId);

  if (team.ownerUserId !== userId) {
    const member = await getMemberRecord(team.id, userId);
    if (member?.role === "team_admin") {
      const createQuota = await resolveEducationTeamAdminCreateQuota(
        team.id,
        team.ownerUserId,
        userId,
        planSlug,
      );
      return {
        maxDecks: Math.min(createQuota.maxCreateDecks, limits.maxDecksPerWorkspace),
        deckCount: createQuota.createdCount,
      };
    }
  }

  return {
    maxDecks: limits.maxDecksPerWorkspace,
    deckCount: workspaceDecks.length,
  };
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
    const quota = await resolveWorkspaceSaveQuota(userId, team);

    return {
      deckOwnerUserId: team.ownerUserId,
      teamId: team.id,
      maxDecks: quota.maxDecks,
      deckCount: quota.deckCount,
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
      const quota = await resolveWorkspaceSaveQuota(userId, workspace);
      return {
        deckOwnerUserId: workspace.ownerUserId,
        teamId: workspace.id,
        maxDecks: quota.maxDecks,
        deckCount: quota.deckCount,
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
    const quota = await resolveWorkspaceSaveQuota(userId, memberWorkspace);
    return {
      deckOwnerUserId: memberWorkspace.ownerUserId,
      teamId: memberWorkspace.id,
      maxDecks: quota.maxDecks,
      deckCount: quota.deckCount,
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
