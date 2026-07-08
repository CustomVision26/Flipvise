/**
 * Creates teacher_registered_students and teacher_manual_grades when missing.
 * Run: npm run db:ensure-teacher-student-tracking-tables
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { neon } from "@neondatabase/serverless";
import { resolveDatabaseUrl } from "../src/lib/resolve-database-url";

async function main() {
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
    ALTER TABLE "teacher_registered_students"
    ADD COLUMN IF NOT EXISTS "classId" integer REFERENCES "teacher_classes"("id") ON DELETE SET NULL
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS "teacher_registered_students_class_id_idx"
    ON "teacher_registered_students" ("classId")
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

  console.log("teacher_registered_students and teacher_manual_grades tables ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
