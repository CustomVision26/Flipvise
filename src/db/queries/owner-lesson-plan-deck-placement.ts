import { and, eq, isNull, like } from "drizzle-orm";
import { db } from "@/db";
import { decks, savedLessonPlans } from "@/db/schema";
import { createDeck } from "@/db/queries/decks";
import { getTeamById, linkDeckToTeamWorkspace } from "@/db/queries/teams";
import { isEducationTeamPlanId } from "@/lib/education-plans";
import { stripLessonPlanScopedDeckSuffix } from "@/lib/teacher-generation-titles";
import { buildTeacherLessonDeckMetadata } from "@/lib/teacher-quiz-deck-save";

const OWNER_LESSON_PLAN_DECK_MARKER = "%Teacher lesson plan deck%";

type SourceDeck = {
  id: number;
  userId: string;
  teamId: number | null;
  name: string;
  createdByUserId: string | null;
  gradeLevel?: string | null;
  difficultyLevel?: string | null;
};

/**
 * When the workspace owner saves a lesson plan from a team-admin deck, keep a
 * separate owner lesson-plan deck. That deck stays on the owner's Personal
 * Dashboard and is not attributed to the team admin, so it does not appear on
 * the team admin Team Dashboard.
 */
export async function ensureOwnerLessonPlanDeckApartFromTeamAdminDeck(input: {
  viewerUserId: string;
  sourceDeck: SourceDeck;
  subject: string;
  topic: string;
  gradeLevel: string;
  difficultyLevel: string;
}): Promise<{ deckId: number; sourceDeckName: string } | null> {
  const ownerUserId = input.viewerUserId.trim();
  const teamId = input.sourceDeck.teamId;
  if (!ownerUserId || teamId == null) return null;
  if (input.sourceDeck.userId !== ownerUserId) return null;

  const creator = input.sourceDeck.createdByUserId?.trim() ?? "";
  if (!creator || creator === ownerUserId) return null;

  const team = await getTeamById(teamId);
  if (!team || team.ownerUserId !== ownerUserId) return null;
  if (!isEducationTeamPlanId(team.planSlug)) return null;

  const baseName =
    stripLessonPlanScopedDeckSuffix(input.sourceDeck.name) ||
    input.sourceDeck.name.trim();
  const { name, description } = buildTeacherLessonDeckMetadata({
    name: baseName,
    subject: input.subject,
    topic: input.topic,
    gradeLevel: input.gradeLevel,
    difficultyLevel: input.difficultyLevel,
  });

  const existing = await findOwnerLessonPlanDeckInWorkspace(
    ownerUserId,
    teamId,
    name,
  );
  if (existing) {
    return { deckId: existing.id, sourceDeckName: name };
  }

  const deckId = await createDeck(
    ownerUserId,
    name,
    description,
    teamId,
    null,
    input.gradeLevel,
    input.difficultyLevel,
    ownerUserId,
  );
  await linkDeckToTeamWorkspace(teamId, deckId);
  return { deckId, sourceDeckName: name };
}

/**
 * Owner-authored lesson plans that were saved onto a team-admin deck are moved
 * onto the owner's lesson-plan deck. The team admin's original deck is unchanged.
 */
export async function relocateOwnerLessonPlansOffTeamAdminDecks(
  ownerUserId: string,
  teamId: number,
): Promise<number> {
  const ownerId = ownerUserId.trim();
  if (!ownerId || !Number.isInteger(teamId) || teamId <= 0) return 0;

  const team = await getTeamById(teamId);
  if (!team || team.ownerUserId !== ownerId) return 0;
  if (!isEducationTeamPlanId(team.planSlug)) return 0;

  const rows = await db
    .select({
      planId: savedLessonPlans.id,
      deckId: decks.id,
      userId: decks.userId,
      teamId: decks.teamId,
      name: decks.name,
      createdByUserId: decks.createdByUserId,
      gradeLevel: decks.gradeLevel,
      difficultyLevel: decks.difficultyLevel,
      subject: savedLessonPlans.subject,
      topic: savedLessonPlans.topic,
      planGrade: savedLessonPlans.gradeLevel,
      planDifficulty: savedLessonPlans.difficultyLevel,
    })
    .from(savedLessonPlans)
    .innerJoin(decks, eq(savedLessonPlans.deckId, decks.id))
    .where(
      and(
        eq(savedLessonPlans.userId, ownerId),
        eq(decks.userId, ownerId),
        eq(decks.teamId, teamId),
        isNull(decks.inactiveAt),
      ),
    );

  let moved = 0;
  for (const row of rows) {
    const creator = row.createdByUserId?.trim() ?? "";
    if (!creator || creator === ownerId) continue;

    const target = await ensureOwnerLessonPlanDeckApartFromTeamAdminDeck({
      viewerUserId: ownerId,
      sourceDeck: {
        id: row.deckId,
        userId: row.userId,
        teamId: row.teamId,
        name: row.name,
        createdByUserId: row.createdByUserId,
        gradeLevel: row.gradeLevel,
        difficultyLevel: row.difficultyLevel,
      },
      subject: row.subject,
      topic: row.topic,
      gradeLevel: row.planGrade || row.gradeLevel || "",
      difficultyLevel: row.planDifficulty || row.difficultyLevel || "",
    });
    if (!target || target.deckId === row.deckId) continue;

    await db
      .update(savedLessonPlans)
      .set({
        deckId: target.deckId,
        sourceDeckName: target.sourceDeckName,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(savedLessonPlans.id, row.planId),
          eq(savedLessonPlans.userId, ownerId),
        ),
      );
    moved += 1;
  }

  return moved;
}

async function findOwnerLessonPlanDeckInWorkspace(
  ownerUserId: string,
  teamId: number,
  name: string,
): Promise<{ id: number } | null> {
  const trimmedName = name.trim();
  if (!trimmedName) return null;

  const [row] = await db
    .select({ id: decks.id })
    .from(decks)
    .where(
      and(
        eq(decks.userId, ownerUserId),
        eq(decks.teamId, teamId),
        eq(decks.createdByUserId, ownerUserId),
        eq(decks.name, trimmedName),
        isNull(decks.inactiveAt),
        like(decks.description, OWNER_LESSON_PLAN_DECK_MARKER),
      ),
    )
    .limit(1);

  return row ?? null;
}
