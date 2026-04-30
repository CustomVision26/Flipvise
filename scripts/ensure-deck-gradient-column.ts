/**
 * Adds `decks.gradient` if missing. Uses the same env merge as Next.js
 * (`.env` then `.env.local`). Run once after deploying this feature:
 *   npx tsx scripts/ensure-deck-gradient-column.ts
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
    ALTER TABLE "decks"
    ADD COLUMN IF NOT EXISTS "gradient" text
  `;
  console.log('Column "gradient" is present on "decks" (created or already existed).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
