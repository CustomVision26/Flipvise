/**
 * Adds quiz start schedule columns when missing.
 * Run: npm run db:ensure-quiz-schedule-columns
 */
import { config } from "dotenv";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (.env / .env.local).");
  process.exit(1);
}

const sql = neon(url);

async function main() {
  await sql`
    ALTER TABLE "teams"
    ADD COLUMN IF NOT EXISTS "quizStartScheduleEnabled" boolean NOT NULL DEFAULT false
  `;

  await sql`
    ALTER TABLE "teams"
    ADD COLUMN IF NOT EXISTS "quizStartAt" timestamp
  `;

  await sql`
    ALTER TABLE "decks"
    ADD COLUMN IF NOT EXISTS "quizStartScheduleEnabled" boolean NOT NULL DEFAULT false
  `;

  await sql`
    ALTER TABLE "decks"
    ADD COLUMN IF NOT EXISTS "quizStartAt" timestamp
  `;

  await sql`
    ALTER TABLE "decks"
    ADD COLUMN IF NOT EXISTS "quizSecurityEnabled" boolean
  `;

  console.log("Quiz schedule and deck security columns are ready.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
