/**
 * Adds `teams.creationProfile` if missing.
 *   npm run db:ensure-team-creation-profile
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
    ADD COLUMN IF NOT EXISTS "creationProfile" json
  `;
  console.log('Column "creationProfile" is present on "teams" (created or already existed).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
