/**
 * Creates saved_study_guides when missing.
 * Run: npm run db:ensure-saved-study-guides-table
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
    CREATE TABLE IF NOT EXISTS "saved_study_guides" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "userId" varchar(255) NOT NULL,
      "label" varchar(255) NOT NULL,
      "guideTitle" varchar(512) NOT NULL,
      "subject" varchar(255) NOT NULL,
      "gradeLevel" varchar(64) NOT NULL,
      "topic" varchar(255) NOT NULL,
      "savedLessonPlanId" integer,
      "sourceLessonPlanTitle" varchar(512),
      "savedHomeworkId" integer,
      "sourceHomeworkLabel" varchar(255),
      "input" json NOT NULL,
      "result" json NOT NULL,
      "pdfUrl" text,
      "pdfFileName" varchar(255),
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "saved_study_guides_user_id_idx"
    ON "saved_study_guides" ("userId")
  `;

  console.log("saved_study_guides table ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
