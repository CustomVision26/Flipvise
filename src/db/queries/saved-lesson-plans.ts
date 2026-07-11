import { db } from "@/db";
import { savedLessonPlans } from "@/db/schema";
import type { DeckRow } from "@/db/queries/decks";
import type { LessonPlanInput, LessonPlanResult } from "@/lib/teacher-generators";
import { lessonPlanMatchesDeck } from "@/lib/lesson-plan-deck-match";
import {
  clampPlanPeriodDays,
  DEFAULT_PLAN_PERIOD_DAYS,
} from "@/lib/lesson-plan-weekly-schedule";
import { getTeamById, listTeamMembers } from "@/db/queries/teams";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";
import { desc, eq, and, inArray, isNotNull } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type SavedLessonPlanRow = InferSelectModel<typeof savedLessonPlans>;

export type SaveLessonPlanInput = {
  userId: string;
  input: LessonPlanInput;
  result: LessonPlanResult;
  pdfUrl?: string | null;
  pdfFileName?: string | null;
  deckId?: number | null;
  sourceDeckName?: string | null;
};

export async function saveLessonPlan(
  data: SaveLessonPlanInput,
): Promise<SavedLessonPlanRow> {
  const [row] = await db
    .insert(savedLessonPlans)
    .values({
      userId: data.userId,
      lessonTitle: data.result.lessonTitle,
      subject: data.input.subject,
      gradeLevel: data.input.gradeLevel,
      topic: data.input.topic,
      difficultyLevel: data.input.difficultyLevel,
      input: data.input,
      result: data.result,
      pdfUrl: data.pdfUrl ?? null,
      pdfFileName: data.pdfFileName ?? null,
      deckId: data.deckId ?? null,
      sourceDeckName: data.sourceDeckName ?? null,
    })
    .returning();

  return row;
}

export async function getDeckIdsWithSavedLessonPlans(): Promise<Set<number>> {
  const rows = await db
    .select({ deckId: savedLessonPlans.deckId })
    .from(savedLessonPlans)
    .where(isNotNull(savedLessonPlans.deckId));

  return new Set(
    rows
      .map((row) => row.deckId)
      .filter((deckId): deckId is number => deckId != null),
  );
}

export type LessonPlanDeckUsage = {
  usedDeckIds: Set<number>;
  usedDeckIdsByUserId: Map<string, Set<number>>;
};

function deckCreatorUserId(deck: DeckRow): string {
  return deck.createdByUserId ?? deck.userId;
}

function resolveDeckIdForSavedLessonPlan(
  plan: SavedLessonPlanRow,
  availableDecks: DeckRow[],
): number | null {
  if (plan.deckId != null) {
    const byId = availableDecks.find((deck) => deck.id === plan.deckId);
    if (byId) return byId.id;
  }

  const sourceName = plan.sourceDeckName?.trim().toLowerCase();
  if (!sourceName) return null;

  const nameMatches = availableDecks.filter(
    (deck) => deck.name.trim().toLowerCase() === sourceName,
  );
  if (nameMatches.length === 0) return null;
  if (nameMatches.length === 1) return nameMatches[0]!.id;

  const ownedByCreator = nameMatches.find(
    (deck) => deckCreatorUserId(deck) === plan.userId,
  );
  return ownedByCreator?.id ?? nameMatches[0]!.id;
}

/** Decks already linked to a saved lesson plan (by deckId or matching source deck name). */
export async function resolveLessonPlanDeckUsage(
  userIds: string[],
  availableDecks: DeckRow[],
): Promise<LessonPlanDeckUsage> {
  const uniqueUserIds = [...new Set(userIds.filter((id) => id.trim().length > 0))];
  const usedDeckIds = new Set<number>();
  const usedDeckIdsByUserId = new Map<string, Set<number>>();

  for (const userId of uniqueUserIds) {
    usedDeckIdsByUserId.set(userId, new Set());
  }

  if (uniqueUserIds.length === 0 || availableDecks.length === 0) {
    return { usedDeckIds, usedDeckIdsByUserId };
  }

  const plans = await getSavedLessonPlansByUserIds(uniqueUserIds);

  const availableDeckIdList = availableDecks
    .map((deck) => deck.id)
    .filter((id) => id > 0);

  if (availableDeckIdList.length > 0) {
    const explicitRows = await db
      .select({ deckId: savedLessonPlans.deckId })
      .from(savedLessonPlans)
      .where(
        and(
          inArray(savedLessonPlans.deckId, availableDeckIdList),
          isNotNull(savedLessonPlans.deckId),
        ),
      );

    for (const row of explicitRows) {
      if (row.deckId != null) {
        usedDeckIds.add(row.deckId);
      }
    }
  }

  for (const plan of plans) {
    const deckId = resolveDeckIdForLessonPlan(plan, availableDecks);
    if (deckId == null) continue;

    usedDeckIds.add(deckId);
    const forUser = usedDeckIdsByUserId.get(plan.userId);
    if (forUser) {
      forUser.add(deckId);
    }
  }

  return { usedDeckIds, usedDeckIdsByUserId };
}

export async function getSavedLessonPlansByUser(
  userId: string,
): Promise<SavedLessonPlanRow[]> {
  return db
    .select()
    .from(savedLessonPlans)
    .where(eq(savedLessonPlans.userId, userId))
    .orderBy(desc(savedLessonPlans.createdAt));
}

export async function getSavedLessonPlansByUserIds(
  userIds: string[],
): Promise<SavedLessonPlanRow[]> {
  if (userIds.length === 0) return [];
  return db
    .select()
    .from(savedLessonPlans)
    .where(inArray(savedLessonPlans.userId, userIds))
    .orderBy(desc(savedLessonPlans.createdAt));
}

export async function getSavedLessonPlanByIdForUser(
  userId: string,
  id: number,
): Promise<SavedLessonPlanRow | null> {
  const [row] = await db
    .select()
    .from(savedLessonPlans)
    .where(and(eq(savedLessonPlans.id, id), eq(savedLessonPlans.userId, userId)))
    .limit(1);

  return row ?? null;
}

export async function getSavedLessonPlanById(
  id: number,
): Promise<SavedLessonPlanRow | null> {
  const [row] = await db
    .select()
    .from(savedLessonPlans)
    .where(eq(savedLessonPlans.id, id))
    .limit(1);

  return row ?? null;
}

function resolveDeckIdForLessonPlan(
  plan: SavedLessonPlanRow,
  availableDecks: DeckRow[],
): number | null {
  const byIdOrName = resolveDeckIdForSavedLessonPlan(plan, availableDecks);
  if (byIdOrName != null) {
    return byIdOrName;
  }

  for (const deck of availableDecks) {
    if (lessonPlanMatchesDeck(plan, deck)) {
      return deck.id;
    }
  }

  return null;
}

/** Most recent saved lesson plan plan-period (school days) per deck for the given user. */
export async function getPlanPeriodDaysByDeckIdsForUser(
  userId: string,
  availableDecks: DeckRow[],
): Promise<Record<number, number>> {
  const targetDeckIds = new Set(
    availableDecks.map((deck) => deck.id).filter((id) => id > 0),
  );
  if (targetDeckIds.size === 0) {
    return {};
  }

  const plans = await getSavedLessonPlansByUser(userId);
  const byDeckId: Record<number, number> = {};

  for (const plan of plans) {
    const deckId = resolveDeckIdForLessonPlan(plan, availableDecks);
    if (deckId == null || !targetDeckIds.has(deckId) || byDeckId[deckId] != null) {
      continue;
    }

    byDeckId[deckId] = clampPlanPeriodDays(
      plan.input.planPeriodDays ?? DEFAULT_PLAN_PERIOD_DAYS,
    );
  }

  return byDeckId;
}

export async function getPlanPeriodDaysForDeckForUser(
  userId: string,
  deckId: number,
  availableDecks: DeckRow[],
): Promise<number | null> {
  const deck = availableDecks.find((row) => row.id === deckId);
  if (!deck) {
    return null;
  }

  const plans = await getSavedLessonPlansByUser(userId);
  for (const plan of plans) {
    const resolvedDeckId = resolveDeckIdForLessonPlan(plan, availableDecks);
    if (resolvedDeckId !== deckId) {
      continue;
    }

    return clampPlanPeriodDays(plan.input.planPeriodDays ?? DEFAULT_PLAN_PERIOD_DAYS);
  }

  return null;
}

export async function getSavedLessonPlanByDeckIdForUser(
  userId: string,
  deckId: number,
): Promise<SavedLessonPlanPickerItem | null> {
  const [row] = await db
    .select()
    .from(savedLessonPlans)
    .where(
      and(eq(savedLessonPlans.userId, userId), eq(savedLessonPlans.deckId, deckId)),
    )
    .orderBy(desc(savedLessonPlans.createdAt))
    .limit(1);

  return row ? mapSavedLessonPlanRowToPickerItem(row) : null;
}

export async function deleteSavedLessonPlanById(
  id: number,
): Promise<SavedLessonPlanRow | null> {
  const [row] = await db
    .delete(savedLessonPlans)
    .where(eq(savedLessonPlans.id, id))
    .returning();

  return row ?? null;
}

export async function updateSavedLessonPlanById(
  planId: number,
  data: {
    input: LessonPlanInput;
    result: LessonPlanResult;
    pdfUrl?: string | null;
    pdfFileName?: string | null;
    deckId?: number | null;
    sourceDeckName?: string | null;
  },
): Promise<SavedLessonPlanRow | null> {
  const [row] = await db
    .update(savedLessonPlans)
    .set({
      lessonTitle: data.result.lessonTitle,
      subject: data.input.subject,
      gradeLevel: data.input.gradeLevel,
      topic: data.input.topic,
      difficultyLevel: data.input.difficultyLevel,
      input: data.input,
      result: data.result,
      pdfUrl: data.pdfUrl ?? null,
      pdfFileName: data.pdfFileName ?? null,
      deckId: data.deckId ?? null,
      sourceDeckName: data.sourceDeckName ?? null,
      updatedAt: new Date(),
    })
    .where(eq(savedLessonPlans.id, planId))
    .returning();

  return row ?? null;
}

export type SavedLessonPlanPickerItem = {
  id: number;
  lessonTitle: string;
  subject: string;
  gradeLevel: string;
  topic: string;
  difficultyLevel: string;
  pdfUrl: string | null;
  deckId: number | null;
  sourceDeckName: string | null;
  input: LessonPlanInput;
  result: LessonPlanResult;
};

export async function getSavedLessonPlansForQuizPicker(
  userId: string,
): Promise<SavedLessonPlanPickerItem[]> {
  const rows = await getSavedLessonPlansByUser(userId);
  return rows.map(mapSavedLessonPlanRowToPickerItem);
}

export function mapSavedLessonPlanRowToPickerItem(
  row: SavedLessonPlanRow,
): SavedLessonPlanPickerItem {
  return {
    id: row.id,
    lessonTitle: row.lessonTitle,
    subject: row.subject,
    gradeLevel: row.gradeLevel,
    topic: row.topic,
    difficultyLevel: row.difficultyLevel,
    pdfUrl: row.pdfUrl,
    deckId: row.deckId,
    sourceDeckName: row.sourceDeckName,
    input: row.input,
    result: row.result,
  };
}

export type TeamAdminQuizPickerOption = {
  userId: string;
  name: string | null;
  email: string | null;
  /** Workspace subscriber who owns the team — their saved resources appear first in owner pickers. */
  isWorkspaceOwner?: boolean;
};

export type OwnerQuizLessonPlanPickerPayload = {
  isWorkspaceOwner: boolean;
  teamAdmins: TeamAdminQuizPickerOption[];
  lessonPlansByAdminUserId: Record<string, SavedLessonPlanPickerItem[]>;
};

export async function loadOwnerQuizLessonPlanPicker(
  viewerUserId: string,
  teamId: number | null,
): Promise<OwnerQuizLessonPlanPickerPayload> {
  if (teamId == null) {
    return {
      isWorkspaceOwner: false,
      teamAdmins: [],
      lessonPlansByAdminUserId: {},
    };
  }

  const team = await getTeamById(teamId);
  if (!team || team.ownerUserId !== viewerUserId) {
    return {
      isWorkspaceOwner: false,
      teamAdmins: [],
      lessonPlansByAdminUserId: {},
    };
  }

  const members = await listTeamMembers(teamId);
  const teamAdmins = members.filter((member) => member.role === "team_admin");
  const creatorUserIds = [
    team.ownerUserId,
    ...teamAdmins.map((member) => member.userId),
  ];

  const [displayById, lessonPlanRows] = await Promise.all([
    getClerkUserFieldDisplaysByIds(creatorUserIds),
    getSavedLessonPlansByUserIds(creatorUserIds),
  ]);

  const lessonPlansByAdminUserId: Record<string, SavedLessonPlanPickerItem[]> = {};
  for (const creatorUserId of creatorUserIds) {
    lessonPlansByAdminUserId[creatorUserId] = [];
  }

  for (const row of lessonPlanRows) {
    const bucket = lessonPlansByAdminUserId[row.userId];
    if (bucket) {
      bucket.push(mapSavedLessonPlanRowToPickerItem(row));
    }
  }

  const ownerDisplay = displayById[team.ownerUserId];
  const pickerOptions: TeamAdminQuizPickerOption[] = [
    {
      userId: team.ownerUserId,
      name: ownerDisplay?.primaryLine ?? null,
      email: ownerDisplay?.primaryEmail ?? null,
      isWorkspaceOwner: true,
    },
    ...teamAdmins.map((member) => {
      const display = displayById[member.userId];
      return {
        userId: member.userId,
        name: display?.primaryLine ?? null,
        email: display?.primaryEmail ?? null,
      };
    }),
  ];

  return {
    isWorkspaceOwner: true,
    teamAdmins: pickerOptions,
    lessonPlansByAdminUserId,
  };
}

export async function resolveSavedLessonPlanForViewer(
  viewerUserId: string,
  planId: number,
  teamId?: number | null,
): Promise<SavedLessonPlanRow | null> {
  const ownPlan = await getSavedLessonPlanByIdForUser(viewerUserId, planId);
  if (ownPlan) return ownPlan;

  if (teamId == null) return null;

  const team = await getTeamById(teamId);
  if (!team || team.ownerUserId !== viewerUserId) return null;

  const plan = await getSavedLessonPlanById(planId);
  if (!plan) return null;

  const members = await listTeamMembers(teamId);
  const workspaceUserIds = new Set([
    team.ownerUserId,
    ...members.map((member) => member.userId),
  ]);

  if (!workspaceUserIds.has(plan.userId)) return null;
  return plan;
}
