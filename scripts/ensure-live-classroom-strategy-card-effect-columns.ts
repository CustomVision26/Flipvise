/**
 * Adds `live_battle_strategy_cards.eliminatedChoices` if missing — stores the
 * two wrong-choice indexes a 50/50 card hid for the using team on a question.
 * Run once if Live Classroom battles error on unknown column:
 *   npx tsx scripts/ensure-live-classroom-strategy-card-effect-columns.ts
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
    ALTER TABLE "live_battle_strategy_cards"
    ADD COLUMN IF NOT EXISTS "eliminatedChoices" integer[]
  `;
  console.log(
    'Column "eliminatedChoices" is present on "live_battle_strategy_cards" (created or already existed).',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
