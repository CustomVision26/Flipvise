/**
 * Adds `live_classroom_participants.survivalLives` if missing — tracks each
 * player's own remaining lives in Survival mode (every player for themselves,
 * not a shared team pool).
 * Run once if Live Classroom battles error on unknown column:
 *   npx tsx scripts/ensure-live-classroom-survival-lives-column.ts
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
    ALTER TABLE "live_classroom_participants"
    ADD COLUMN IF NOT EXISTS "survivalLives" integer NOT NULL DEFAULT 3
  `;
  console.log(
    'Column "survivalLives" is present on "live_classroom_participants" (created or already existed).',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
