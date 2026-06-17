/**
 * Adds quiz question format columns + cards.quizVariants if missing.
 * Uses the same env merge as Next.js (`.env` then `.env.local`).
 *
 *   npm run db:ensure-quiz-question-formats
 */
import { config } from "dotenv";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";
import { resolveDatabaseUrl } from "../src/lib/resolve-database-url";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const sql = neon(resolveDatabaseUrl());

async function main() {
  await sql`ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "quizFormatMultipleChoice" boolean DEFAULT true NOT NULL`;
  await sql`ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "quizFormatTrueFalse" boolean DEFAULT false NOT NULL`;
  await sql`ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "quizFormatFillInBlank" boolean DEFAULT false NOT NULL`;
  await sql`ALTER TABLE "decks" ADD COLUMN IF NOT EXISTS "quizFormatMultipleChoice" boolean`;
  await sql`ALTER TABLE "decks" ADD COLUMN IF NOT EXISTS "quizFormatTrueFalse" boolean`;
  await sql`ALTER TABLE "decks" ADD COLUMN IF NOT EXISTS "quizFormatFillInBlank" boolean`;
  await sql`ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "quizVariants" json`;

  const cols = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cards'
      AND column_name = 'quizVariants'
  `;
  if (cols.length === 0) {
    throw new Error('Column "quizVariants" is still missing on "cards" after migration.');
  }

  console.log("Quiz question format columns are present (created or already existed).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
