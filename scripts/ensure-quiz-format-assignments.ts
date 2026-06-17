import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = neon(url);
  await sql`ALTER TABLE decks ADD COLUMN IF NOT EXISTS "quizFormatAssignments" json`;
  console.log("quizFormatAssignments column ensured on decks");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
