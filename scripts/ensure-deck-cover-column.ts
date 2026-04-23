/**
 * Adds `decks.coverImageUrl` if missing. Uses the same env merge as Next.js
 * (`.env` then `.env.local`). Run once if deck pages error on unknown column:
 *   npx tsx scripts/ensure-deck-cover-column.ts
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
    ADD COLUMN IF NOT EXISTS "coverImageUrl" text
  `;
  console.log('Column "coverImageUrl" is present on "decks" (created or already existed).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
