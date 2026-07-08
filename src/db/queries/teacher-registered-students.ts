import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  teacherRegisteredStudents,
  type TeacherRegisteredStudentRow,
} from "@/db/schema";
import { withTeacherRegisteredStudentsTable } from "@/lib/ensure-teacher-student-tracking-tables";

export async function listTeacherRegisteredStudentsForUser(
  userId: string,
): Promise<TeacherRegisteredStudentRow[]> {
  return withTeacherRegisteredStudentsTable(() =>
    db
      .select()
      .from(teacherRegisteredStudents)
      .where(eq(teacherRegisteredStudents.userId, userId))
      .orderBy(desc(teacherRegisteredStudents.createdAt)),
  );
}

export async function createTeacherRegisteredStudent(
  userId: string,
  input: {
    fullName: string;
    email: string;
    telephone: string | null;
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
      })
      .returning();

    return row;
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
