/**
 * Creates teacher_classes table when missing.
 * Run: npm run db:ensure-teacher-classes-table
 */

import "dotenv/config";

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS "teacher_classes" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "userId" varchar(255) NOT NULL,
      "teamId" integer REFERENCES "teams"("id") ON DELETE CASCADE,
      "deckId" integer NOT NULL REFERENCES "decks"("id") ON DELETE CASCADE,
      "academicYear" varchar(64) NOT NULL,
      "termSemester" varchar(128) NOT NULL,
      "week" varchar(64) NOT NULL,
      "day" varchar(64) NOT NULL,
      "period" varchar(64) NOT NULL,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "teacher_classes_user_id_idx"
    ON "teacher_classes" ("userId")
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "teacher_classes_team_id_idx"
    ON "teacher_classes" ("teamId")
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "teacher_classes_deck_id_idx"
    ON "teacher_classes" ("deckId")
  `;

  console.log("teacher_classes table ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
