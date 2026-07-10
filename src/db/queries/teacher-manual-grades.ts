import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { decks, teacherManualGrades, type TeacherManualGradeRow } from "@/db/schema";
import { getSavedLessonPlansByUser } from "@/db/queries/saved-lesson-plans";
import { withTeacherManualGradesTable } from "@/lib/ensure-teacher-student-tracking-tables";

export type TeacherManualGradeType = "assignment" | "quiz";

export type TeacherManualGradeQuizOption = {
  key: string;
  title: string;
  deckId: number;
  resultId?: number;
  percent?: number;
  savedAt?: Date;
};

export async function listTeacherManualGradeQuizOptionsForUser(
  userId: string,
): Promise<TeacherManualGradeQuizOption[]> {
  const [deckRows, lessonPlans] = await Promise.all([
    db
      .select({
        id: decks.id,
        name: decks.name,
      })
      .from(decks)
      .where(eq(decks.userId, userId))
      .orderBy(desc(decks.updatedAt)),
    getSavedLessonPlansByUser(userId),
  ]);

  const options: TeacherManualGradeQuizOption[] = [];
  const seen = new Set<string>();

  for (const deck of deckRows) {
    const key = `deck-${deck.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({
      key,
      title: `${deck.name} Quiz`,
      deckId: deck.id,
    });
  }

  for (const plan of lessonPlans) {
    if (plan.deckId == null) continue;
    const key = `lesson-${plan.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({
      key,
      title: `${plan.lessonTitle} Quiz`,
      deckId: plan.deckId,
    });
  }

  return options;
}

export async function listTeacherManualGradesForWorkspace(
  userId: string,
  teamId: number | null,
): Promise<TeacherManualGradeRow[]> {
  const whereClause =
    teamId != null
      ? and(eq(teacherManualGrades.userId, userId), eq(teacherManualGrades.teamId, teamId))
      : and(eq(teacherManualGrades.userId, userId), isNull(teacherManualGrades.teamId));

  return withTeacherManualGradesTable(() =>
    db
      .select()
      .from(teacherManualGrades)
      .where(whereClause)
      .orderBy(desc(teacherManualGrades.createdAt)),
  );
}

export async function createTeacherManualGrade(
  userId: string,
  input: {
    teamId: number | null;
    studentName: string;
    studentEmail: string | null;
    assignmentTitle: string;
    grade: string;
    maxGrade: string | null;
    subject: string | null;
    academicYear: string;
    termSemester: string;
    period: string | null;
    notes: string | null;
    gradeType: TeacherManualGradeType;
  },
): Promise<TeacherManualGradeRow> {
  return withTeacherManualGradesTable(async () => {
    const [row] = await db
      .insert(teacherManualGrades)
      .values({
        userId,
        teamId: input.teamId,
        studentName: input.studentName,
        studentEmail: input.studentEmail,
        assignmentTitle: input.assignmentTitle,
        grade: input.grade,
        maxGrade: input.maxGrade,
        subject: input.subject,
        academicYear: input.academicYear,
        termSemester: input.termSemester,
        period: input.period,
        notes: input.notes,
        gradeType: input.gradeType,
      })
      .returning();

    return row;
  });
}

export async function updateTeacherManualGrade(
  userId: string,
  gradeId: number,
  input: {
    studentName: string;
    studentEmail: string | null;
    assignmentTitle: string;
    grade: string;
    maxGrade: string | null;
    subject: string | null;
    academicYear: string;
    termSemester: string;
    period: string | null;
    notes: string | null;
    gradeType: TeacherManualGradeType;
  },
): Promise<TeacherManualGradeRow | null> {
  return withTeacherManualGradesTable(async () => {
    const [row] = await db
      .update(teacherManualGrades)
      .set({
        studentName: input.studentName,
        studentEmail: input.studentEmail,
        assignmentTitle: input.assignmentTitle,
        grade: input.grade,
        maxGrade: input.maxGrade,
        subject: input.subject,
        academicYear: input.academicYear,
        termSemester: input.termSemester,
        period: input.period,
        notes: input.notes,
        gradeType: input.gradeType,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(teacherManualGrades.id, gradeId),
          eq(teacherManualGrades.userId, userId),
        ),
      )
      .returning();

    return row ?? null;
  });
}

export async function deleteTeacherManualGrade(
  userId: string,
  gradeId: number,
): Promise<TeacherManualGradeRow | null> {
  return withTeacherManualGradesTable(async () => {
    const [row] = await db
      .delete(teacherManualGrades)
      .where(
        and(
          eq(teacherManualGrades.id, gradeId),
          eq(teacherManualGrades.userId, userId),
        ),
      )
      .returning();

    return row ?? null;
  });
}
