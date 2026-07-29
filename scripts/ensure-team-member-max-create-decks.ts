/**
 * Ensures team_members.maxCreateDecks exists.
 * Run: npx tsx scripts/ensure-team-member-max-create-decks.ts
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL;

if (!databaseUrl) {
  throw new Error(
    "Database URL is not set. Use DATABASE_URL (or POSTGRES_URL / POSTGRES_PRISMA_URL) in .env / .env.local.",
  );
}

const sql = neon(databaseUrl);

async function main() {
  await sql`
    ALTER TABLE "team_members"
    ADD COLUMN IF NOT EXISTS "maxCreateDecks" integer
  `;

  const cols = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'team_members'
      AND column_name = 'maxCreateDecks'
  `;
  console.log("team_members.maxCreateDecks ready:", cols[0] ?? "MISSING");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
