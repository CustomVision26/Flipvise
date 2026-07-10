import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  decks,
  teacherClasses,
  teacherRegisteredStudents,
  type TeacherRegisteredStudentRow,
} from "@/db/schema";
import { withTeacherRegisteredStudentsTable } from "@/lib/ensure-teacher-student-tracking-tables";

export type TeacherRegisteredStudentWithClass = TeacherRegisteredStudentRow & {
  classPeriod: string | null;
  classDeckId: number | null;
  classDeckName: string | null;
  classAcademicYear: string | null;
  classTermSemester: string | null;
  classWeek: string | null;
};

export async function listTeacherRegisteredStudentsForUser(
  userId: string,
): Promise<TeacherRegisteredStudentWithClass[]> {
  return withTeacherRegisteredStudentsTable(() =>
    db
      .select({
        id: teacherRegisteredStudents.id,
        userId: teacherRegisteredStudents.userId,
        fullName: teacherRegisteredStudents.fullName,
        email: teacherRegisteredStudents.email,
        telephone: teacherRegisteredStudents.telephone,
        classId: teacherRegisteredStudents.classId,
        createdAt: teacherRegisteredStudents.createdAt,
        updatedAt: teacherRegisteredStudents.updatedAt,
        classPeriod: teacherClasses.period,
        classDeckId: teacherClasses.deckId,
        classDeckName: decks.name,
        classAcademicYear: teacherClasses.academicYear,
        classTermSemester: teacherClasses.termSemester,
        classWeek: teacherClasses.week,
      })
      .from(teacherRegisteredStudents)
      .leftJoin(teacherClasses, eq(teacherRegisteredStudents.classId, teacherClasses.id))
      .leftJoin(decks, eq(teacherClasses.deckId, decks.id))
      .where(eq(teacherRegisteredStudents.userId, userId))
      .orderBy(desc(teacherRegisteredStudents.createdAt)),
  );
}

export async function getTeacherRegisteredStudentById(
  userId: string,
  studentId: number,
): Promise<TeacherRegisteredStudentRow | null> {
  return withTeacherRegisteredStudentsTable(async () => {
    const [row] = await db
      .select()
      .from(teacherRegisteredStudents)
      .where(
        and(
          eq(teacherRegisteredStudents.id, studentId),
          eq(teacherRegisteredStudents.userId, userId),
        ),
      )
      .limit(1);

    return row ?? null;
  });
}

export async function createTeacherRegisteredStudent(
  userId: string,
  input: {
    fullName: string;
    email: string;
    telephone: string | null;
    classId: number | null;
  },
): Promise<TeacherRegisteredStudentRow> {
  return withTeacherRegisteredStudentsTable(async () => {
    const [row] = await db
      .insert(teacherRegisteredStudents)
      .values({
        userId,
        fullName: input.fullName,
        email: input.email,
        telephone: input.telephone,
        classId: input.classId,
      })
      .returning();

    return row;
  });
}

export async function updateTeacherRegisteredStudent(
  userId: string,
  studentId: number,
  input: {
    fullName: string;
    email: string;
    telephone: string | null;
    classId: number | null;
  },
): Promise<TeacherRegisteredStudentRow | null> {
  return withTeacherRegisteredStudentsTable(async () => {
    const [row] = await db
      .update(teacherRegisteredStudents)
      .set({
        fullName: input.fullName,
        email: input.email,
        telephone: input.telephone,
        classId: input.classId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(teacherRegisteredStudents.id, studentId),
          eq(teacherRegisteredStudents.userId, userId),
        ),
      )
      .returning();

    return row ?? null;
  });
}

export async function deleteTeacherRegisteredStudent(
  userId: string,
  studentId: number,
): Promise<TeacherRegisteredStudentRow | null> {
  return withTeacherRegisteredStudentsTable(async () => {
    const [row] = await db
      .delete(teacherRegisteredStudents)
      .where(
        and(
          eq(teacherRegisteredStudents.id, studentId),
          eq(teacherRegisteredStudents.userId, userId),
        ),
      )
      .returning();

    return row ?? null;
  });
}
