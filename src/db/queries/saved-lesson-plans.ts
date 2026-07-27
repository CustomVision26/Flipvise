import { db } from "@/db";
import { savedLessonPlans } from "@/db/schema";
import type { DeckRow } from "@/db/queries/decks";
import type { LessonPlanInput, LessonPlanResult } from "@/lib/teacher-generators";
import { lessonPlanMatchesDeck } from "@/lib/lesson-plan-deck-match";
import {
  clampPlanPeriodDays,
  DEFAULT_PLAN_PERIOD_DAYS,
} from "@/lib/lesson-plan-weekly-schedule";
import {
  deckHasAnyTeamAssignments,
  getAssignedDecksForMember,
  getTeamById,
  listTeamMembers,
} from "@/db/queries/teams";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";
import { desc, eq, and, inArray, isNotNull, isNull } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type SavedLessonPlanRow = InferSelectModel<typeof savedLessonPlans>;

export type SaveLessonPlanInput = {
  userId: string;
  input: LessonPlanInput;
  result: LessonPlanResult;
  pdfUrl?: string | null;
  pdfFileName?: string | null;
  vocabularyDetailPdfUrl?: string | null;
  vocabularyDetailPdfFileName?: string | null;
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
      vocabularyDetailPdfUrl: data.vocabularyDetailPdfUrl ?? null,
      vocabularyDetailPdfFileName: data.vocabularyDetailPdfFileName ?? null,
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

/** Lesson plans explicitly linked to any of the given decks (any owner). */
export async function getSavedLessonPlansByDeckIds(
  deckIds: number[],
): Promise<SavedLessonPlanRow[]> {
  const uniqueDeckIds = [...new Set(deckIds.filter((id) => id > 0))];
  if (uniqueDeckIds.length === 0) return [];
  return db
    .select()
    .from(savedLessonPlans)
    .where(
      and(
        inArray(savedLessonPlans.deckId, uniqueDeckIds),
        isNotNull(savedLessonPlans.deckId),
      ),
    )
    .orderBy(desc(savedLessonPlans.createdAt));
}

/**
 * Original lesson plans linked to decks assigned to `memberUserId` on `teamId`.
 * Query-time inclusion (no copy on assign). Excludes plans already owned by the member.
 */
export async function getAssignedDeckLessonPlansForMember(
  teamId: number,
  memberUserId: string,
): Promise<SavedLessonPlanRow[]> {
  const assignedDecks = await getAssignedDecksForMember(teamId, memberUserId);
  if (assignedDecks.length === 0) return [];

  const plans = await getSavedLessonPlansByDeckIds(
    assignedDecks.map((deck) => deck.id),
  );

  return plans.filter((plan) => plan.userId !== memberUserId);
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

/**
 * Lesson plan linked to a deck for Edit-deck → Lesson Builder sync.
 * Prefers the viewer's own plan; otherwise the most recent plan for that deckId.
 */
export async function getPrimaryLinkedLessonPlanForDeck(
  deckId: number,
  viewerUserId: string,
): Promise<SavedLessonPlanRow | null> {
  if (!Number.isFinite(deckId) || deckId <= 0) return null;

  const plans = await getSavedLessonPlansByDeckIds([deckId]);
  if (plans.length === 0) return null;

  const own = plans.find((plan) => plan.userId === viewerUserId);
  return own ?? plans[0] ?? null;
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

/**
 * Deck-linked lesson plans that are currently assigned to any team member are
 * immutable. Assignees (and creators after assignment) must copy-on-write.
 */
export async function isDeckLinkedLessonPlanFrozenByAssignments(
  plan: Pick<SavedLessonPlanRow, "deckId">,
): Promise<boolean> {
  if (plan.deckId == null) return false;
  return deckHasAnyTeamAssignments(plan.deckId);
}

export async function updateSavedLessonPlanById(
  planId: number,
  data: {
    input: LessonPlanInput;
    result: LessonPlanResult;
    pdfUrl?: string | null;
    pdfFileName?: string | null;
    vocabularyDetailPdfUrl?: string | null;
    vocabularyDetailPdfFileName?: string | null;
    deckId?: number | null;
    sourceDeckName?: string | null;
  },
): Promise<SavedLessonPlanRow | null> {
  const existing = await getSavedLessonPlanById(planId);
  if (!existing) return null;
  if (await isDeckLinkedLessonPlanFrozenByAssignments(existing)) {
    throw new Error(
      "This lesson plan is linked to an assigned deck and cannot be overwritten. Save changes as a personal copy instead.",
    );
  }

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
      vocabularyDetailPdfUrl: data.vocabularyDetailPdfUrl ?? null,
      vocabularyDetailPdfFileName: data.vocabularyDetailPdfFileName ?? null,
      deckId: data.deckId ?? null,
      sourceDeckName: data.sourceDeckName ?? null,
      updatedAt: new Date(),
    })
    .where(eq(savedLessonPlans.id, planId))
    .returning();

  return row ?? null;
}

/**
 * Update an assignee personal copy only.
 * Requires ownership (`userId`) and an unlinked row (`deckId` null) so
 * deck-linked creator originals can never be mutated through this path.
 */
export async function updateAssigneePersonalLessonPlanCopyById(
  userId: string,
  planId: number,
  data: {
    input: LessonPlanInput;
    result: LessonPlanResult;
    pdfUrl?: string | null;
    pdfFileName?: string | null;
    vocabularyDetailPdfUrl?: string | null;
    vocabularyDetailPdfFileName?: string | null;
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
      vocabularyDetailPdfUrl: data.vocabularyDetailPdfUrl ?? null,
      vocabularyDetailPdfFileName: data.vocabularyDetailPdfFileName ?? null,
      deckId: null,
      sourceDeckName: data.sourceDeckName ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(savedLessonPlans.id, planId),
        eq(savedLessonPlans.userId, userId),
        isNull(savedLessonPlans.deckId),
      ),
    )
    .returning();

  return row ?? null;
}

/** Patch intake fields only — keeps generated result and PDFs unchanged. */
export async function updateSavedLessonPlanIntakeById(
  planId: number,
  data: {
    input: LessonPlanInput;
    sourceDeckName?: string | null;
  },
): Promise<SavedLessonPlanRow | null> {
  const existing = await getSavedLessonPlanById(planId);
  if (!existing) return null;
  if (await isDeckLinkedLessonPlanFrozenByAssignments(existing)) {
    throw new Error(
      "This lesson plan is linked to an assigned deck and cannot be overwritten. Save changes as a personal copy instead.",
    );
  }

  const [row] = await db
    .update(savedLessonPlans)
    .set({
      subject: data.input.subject,
      gradeLevel: data.input.gradeLevel,
      topic: data.input.topic,
      difficultyLevel: data.input.difficultyLevel,
      input: data.input,
      ...(data.sourceDeckName !== undefined
        ? { sourceDeckName: data.sourceDeckName }
        : {}),
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
  vocabularyDetailPdfUrl: string | null;
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
    vocabularyDetailPdfUrl: row.vocabularyDetailPdfUrl,
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
  if (!team) return null;

  const plan = await getSavedLessonPlanById(planId);
  if (!plan) return null;

  if (team.ownerUserId === viewerUserId) {
    const members = await listTeamMembers(teamId);
    const workspaceUserIds = new Set([
      team.ownerUserId,
      ...members.map((member) => member.userId),
    ]);

    if (!workspaceUserIds.has(plan.userId)) return null;
    return plan;
  }

  // Assignees may open originals linked to decks assigned to them (read + copy-on-write save).
  if (plan.deckId == null) return null;

  const assignedDecks = await getAssignedDecksForMember(teamId, viewerUserId);
  if (!assignedDecks.some((deck) => deck.id === plan.deckId)) return null;
  return plan;
}

/** True when the viewer may see the plan only via an assigned-deck link (not as owner). */
export async function isAssignedDeckLessonPlanForViewer(
  viewerUserId: string,
  plan: SavedLessonPlanRow,
  teamId: number | null | undefined,
): Promise<boolean> {
  if (plan.userId === viewerUserId) return false;
  if (teamId == null || plan.deckId == null) return false;

  const team = await getTeamById(teamId);
  if (!team || team.ownerUserId === viewerUserId) return false;

  const assignedDecks = await getAssignedDecksForMember(teamId, viewerUserId);
  return assignedDecks.some((deck) => deck.id === plan.deckId);
}

function normalizeMatchText(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

/**
 * Assignee personal copies are unlinked (`deckId` null) and keep `sourceDeckName`
 * (and usually subject/topic) from the assigned-deck original.
 *
 * Match order: source deck name → current intake subject/topic → original
 * subject/topic (so renaming intake still updates the same personal row).
 * Never returns a deck-linked original (`deckId` non-null).
 */
export async function findPersonalLessonPlanCopyForAssignedContext(
  userId: string,
  context: {
    sourceDeckName?: string | null;
    subject?: string | null;
    topic?: string | null;
    /** Creator-plan subject — used when intake subject/topic already changed. */
    sourceSubject?: string | null;
    /** Creator-plan topic — used when intake subject/topic already changed. */
    sourceTopic?: string | null;
    excludePlanId?: number;
  },
): Promise<SavedLessonPlanRow | null> {
  const plans = await getSavedLessonPlansByUser(userId);
  // Personal copies only: never match a deck-linked (or other-user) row.
  const personalCopies = plans.filter(
    (plan) =>
      plan.userId === userId &&
      plan.deckId == null &&
      (context.excludePlanId == null || plan.id !== context.excludePlanId),
  );
  if (personalCopies.length === 0) return null;

  const sourceName = normalizeMatchText(context.sourceDeckName);
  if (sourceName) {
    const bySourceName = personalCopies.find(
      (plan) => normalizeMatchText(plan.sourceDeckName) === sourceName,
    );
    if (bySourceName) return bySourceName;
  }

  const subject = normalizeMatchText(context.subject);
  const topic = normalizeMatchText(context.topic);
  if (subject && topic) {
    const bySubjectTopic = personalCopies.find(
      (plan) =>
        normalizeMatchText(plan.subject) === subject &&
        normalizeMatchText(plan.topic) === topic,
    );
    if (bySubjectTopic) return bySubjectTopic;
  }

  const sourceSubject = normalizeMatchText(context.sourceSubject);
  const sourceTopic = normalizeMatchText(context.sourceTopic);
  if (sourceSubject && sourceTopic) {
    const byOriginalSubjectTopic = personalCopies.find(
      (plan) =>
        normalizeMatchText(plan.subject) === sourceSubject &&
        normalizeMatchText(plan.topic) === sourceTopic,
    );
    if (byOriginalSubjectTopic) return byOriginalSubjectTopic;
  }

  return null;
}
