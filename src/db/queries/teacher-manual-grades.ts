import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { teacherManualGrades, type TeacherManualGradeRow } from "@/db/schema";
import { withTeacherManualGradesTable } from "@/lib/ensure-teacher-student-tracking-tables";

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
      })
      .returning();

    return row;
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
