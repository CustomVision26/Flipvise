import { db } from "@/db";
import { savedLessonPlans } from "@/db/schema";
import type { LessonPlanInput, LessonPlanResult } from "@/lib/teacher-generators";
import { getTeamById, listTeamMembers } from "@/db/queries/teams";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";
import { desc, eq, and, inArray } from "drizzle-orm";
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

export async function deleteSavedLessonPlanById(
  id: number,
): Promise<SavedLessonPlanRow | null> {
  const [row] = await db
    .delete(savedLessonPlans)
    .where(eq(savedLessonPlans.id, id))
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
