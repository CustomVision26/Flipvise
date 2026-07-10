import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { decks, teacherClasses, type TeacherClassRow } from "@/db/schema";
import { getTeamById, listTeamMembers } from "@/db/queries/teams";
import type { WorkspaceMemberMeta } from "@/lib/teacher-workspace-member-grouping";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";

export type TeacherClassWithDeck = TeacherClassRow & {
  deckName: string;
  deckGradeLevel: string | null;
  deckDescription: string | null;
};

const teacherClassSelect = {
  id: teacherClasses.id,
  userId: teacherClasses.userId,
  teamId: teacherClasses.teamId,
  deckId: teacherClasses.deckId,
  academicYear: teacherClasses.academicYear,
  termSemester: teacherClasses.termSemester,
  week: teacherClasses.week,
  day: teacherClasses.day,
  period: teacherClasses.period,
  createdAt: teacherClasses.createdAt,
  updatedAt: teacherClasses.updatedAt,
  deckName: decks.name,
  deckGradeLevel: decks.gradeLevel,
  deckDescription: decks.description,
};

export type TeacherClassCreatorDisplay = {
  name: string | null;
  email: string | null;
  role: "owner" | "team_admin" | "team_member" | null;
};

export type TeacherClassesPagePayload = {
  classes: TeacherClassWithDeck[];
  creatorDisplayByUserId: Record<string, TeacherClassCreatorDisplay>;
  ownerUserId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  memberMetaByUserId: Record<string, WorkspaceMemberMeta>;
  isWorkspaceOwner: boolean;
};

function resolveMemberRole(
  userId: string,
  ownerUserId: string,
  memberMetaByUserId: Record<string, WorkspaceMemberMeta>,
): TeacherClassCreatorDisplay["role"] {
  if (userId === ownerUserId) return "owner";
  const meta = memberMetaByUserId[userId];
  if (meta?.role === "team_admin") return "team_admin";
  if (meta?.role === "team_member") return "team_member";
  return null;
}

async function queryTeacherClasses(
  whereClause: ReturnType<typeof and>,
): Promise<TeacherClassWithDeck[]> {
  return db
    .select(teacherClassSelect)
    .from(teacherClasses)
    .innerJoin(decks, eq(teacherClasses.deckId, decks.id))
    .where(whereClause)
    .orderBy(desc(teacherClasses.createdAt));
}

export async function listTeacherClassesForUser(
  userId: string,
  teamId: number | null,
): Promise<TeacherClassWithDeck[]> {
  const scopeFilter =
    teamId != null
      ? eq(teacherClasses.teamId, teamId)
      : isNull(teacherClasses.teamId);

  return queryTeacherClasses(and(eq(teacherClasses.userId, userId), scopeFilter));
}

export async function listTeacherClassesForTeam(
  teamId: number,
): Promise<TeacherClassWithDeck[]> {
  return queryTeacherClasses(eq(teacherClasses.teamId, teamId));
}

export async function loadTeacherClassesPagePayload(
  viewerUserId: string,
  teamId: number | null,
): Promise<TeacherClassesPagePayload> {
  const team = teamId != null ? await getTeamById(teamId) : null;
  const isWorkspaceOwner = team != null && team.ownerUserId === viewerUserId;
  const ownerUserId = team?.ownerUserId ?? viewerUserId;

  const members = teamId != null ? await listTeamMembers(teamId) : [];
  const memberMetaByUserId: Record<string, WorkspaceMemberMeta> = {};

  const classes =
    isWorkspaceOwner && teamId != null
      ? await listTeacherClassesForTeam(teamId)
      : await listTeacherClassesForUser(viewerUserId, teamId);

  const userIds = [
    ...new Set([
      ownerUserId,
      ...members.map((member) => member.userId),
      ...classes.map((cls) => cls.userId),
      ...members.map((member) => member.addedByUserId).filter((id): id is string => Boolean(id)),
    ]),
  ];
  const userDisplayById = await getClerkUserFieldDisplaysByIds(userIds);
  const ownerDisplay = userDisplayById[ownerUserId];

  for (const member of members) {
    const display = userDisplayById[member.userId];
    memberMetaByUserId[member.userId] = {
      role: member.role,
      addedByUserId: member.addedByUserId ?? null,
      addedByAsOwner: member.addedByAsOwner ?? null,
      name: display?.primaryLine ?? null,
      email: display?.primaryEmail ?? null,
    };
  }

  const creatorDisplayByUserId: Record<string, TeacherClassCreatorDisplay> = {};
  for (const userId of userIds) {
    const display = userDisplayById[userId];
    creatorDisplayByUserId[userId] = {
      name: display?.primaryLine ?? null,
      email: display?.primaryEmail ?? null,
      role: resolveMemberRole(userId, ownerUserId, memberMetaByUserId),
    };
  }

  return {
    classes,
    creatorDisplayByUserId,
    ownerUserId,
    ownerName: ownerDisplay?.primaryLine ?? null,
    ownerEmail: ownerDisplay?.primaryEmail ?? null,
    memberMetaByUserId,
    isWorkspaceOwner,
  };
}

export async function createTeacherClass(
  userId: string,
  input: {
    teamId: number | null;
    deckId: number;
    academicYear: string;
    termSemester: string;
    week: string;
    day: string;
    period: string;
  },
): Promise<TeacherClassRow> {
  const [row] = await db
    .insert(teacherClasses)
    .values({
      userId,
      teamId: input.teamId,
      deckId: input.deckId,
      academicYear: input.academicYear,
      termSemester: input.termSemester,
      week: input.week,
      day: input.day,
      period: input.period,
    })
    .returning();

  if (!row) {
    throw new Error("Could not create class.");
  }

  return row;
}

export async function getTeacherClassById(
  id: number,
): Promise<TeacherClassRow | null> {
  const [row] = await db
    .select()
    .from(teacherClasses)
    .where(eq(teacherClasses.id, id))
    .limit(1);

  return row ?? null;
}

export async function updateTeacherClassById(
  id: number,
  input: {
    deckId: number;
    academicYear: string;
    termSemester: string;
    week: string;
    day: string;
    period: string;
  },
): Promise<TeacherClassRow> {
  const [row] = await db
    .update(teacherClasses)
    .set({
      deckId: input.deckId,
      academicYear: input.academicYear,
      termSemester: input.termSemester,
      week: input.week,
      day: input.day,
      period: input.period,
      updatedAt: new Date(),
    })
    .where(eq(teacherClasses.id, id))
    .returning();

  if (!row) {
    throw new Error("Could not update class.");
  }

  return row;
}

export async function deleteTeacherClassById(
  id: number,
): Promise<TeacherClassRow | null> {
  const [row] = await db
    .delete(teacherClasses)
    .where(eq(teacherClasses.id, id))
    .returning();

  return row ?? null;
}
