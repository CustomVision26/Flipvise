import "server-only";

import { neon } from "@neondatabase/serverless";
import { resolveDatabaseUrl } from "@/lib/resolve-database-url";

let ensurePromise: Promise<void> | null = null;

export async function ensureTeacherStudentTrackingTables(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = runEnsure().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  await ensurePromise;
}

async function runEnsure(): Promise<void> {
  const sql = neon(resolveDatabaseUrl());

  await sql`
    CREATE TABLE IF NOT EXISTS "teacher_registered_students" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "userId" varchar(255) NOT NULL,
      "fullName" varchar(255) NOT NULL,
      "email" varchar(255) NOT NULL,
      "telephone" varchar(64),
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS "teacher_registered_students_user_id_idx"
    ON "teacher_registered_students" ("userId")
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "teacher_manual_grades" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "userId" varchar(255) NOT NULL,
      "teamId" integer REFERENCES "teams"("id") ON DELETE CASCADE,
      "studentName" varchar(255) NOT NULL,
      "studentEmail" varchar(255),
      "assignmentTitle" varchar(512) NOT NULL,
      "grade" varchar(32) NOT NULL,
      "maxGrade" varchar(32),
      "subject" varchar(255),
      "academicYear" varchar(64) NOT NULL,
      "termSemester" varchar(128) NOT NULL,
      "period" varchar(64),
      "notes" text,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS "teacher_manual_grades_user_id_idx"
    ON "teacher_manual_grades" ("userId")
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS "teacher_manual_grades_team_id_idx"
    ON "teacher_manual_grades" ("teamId")
  `;
}

function isMissingTeacherStudentTrackingTableError(
  error: unknown,
  tableName: "teacher_registered_students" | "teacher_manual_grades",
): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 8 && current && typeof current === "object"; depth++) {
    const obj = current as Record<string, unknown>;
    if (obj.code === "42P01") return true;
    const message = typeof obj.message === "string" ? obj.message : "";
    if (
      message.includes(tableName) &&
      /(does not exist|relation)/i.test(message)
    ) {
      return true;
    }
    current = obj.cause;
  }

  const flat = String(error);
  return (
    (/42P01/i.test(flat) || /does not exist/i.test(flat) || /Failed query/i.test(flat)) &&
    flat.includes(tableName)
  );
}

export async function withTeacherRegisteredStudentsTable<T>(
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isMissingTeacherStudentTrackingTableError(error, "teacher_registered_students")) {
      throw error;
    }
    await ensureTeacherStudentTrackingTables();
    return await fn();
  }
}

export async function withTeacherManualGradesTable<T>(
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isMissingTeacherStudentTrackingTableError(error, "teacher_manual_grades")) {
      throw error;
    }
    await ensureTeacherStudentTrackingTables();
    return await fn();
  }
}
