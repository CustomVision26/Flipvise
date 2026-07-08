/**
 * Adds saved_lesson_plans.deckId + sourceDeckName when missing.
 * Run: npm run db:ensure-saved-lesson-plans-deck-columns
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
    ALTER TABLE "saved_lesson_plans"
    ADD COLUMN IF NOT EXISTS "deckId" integer
  `;
  await sql`
    ALTER TABLE "saved_lesson_plans"
    ADD COLUMN IF NOT EXISTS "sourceDeckName" varchar(255)
  `;
  console.log(
    'Columns "deckId" and "sourceDeckName" are present on "saved_lesson_plans".',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
