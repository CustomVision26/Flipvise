/**
 * Ensures essay_drafts.sectionsContent exists (dynamic essay builder v2).
 * Run: npx tsx scripts/ensure-essay-sections-content.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const sql = neon(url);
  await sql`
    ALTER TABLE essay_drafts
    ADD COLUMN IF NOT EXISTS "sectionsContent" json DEFAULT '{}'::json NOT NULL
  `;
  console.log("essay_drafts.sectionsContent is ready.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
