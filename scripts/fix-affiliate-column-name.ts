/**
 * Renames invite_accepted_at → inviteAcceptedAt to match the camelCase
 * convention used by all other columns in the affiliates table.
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  // Check if the snake_case column exists before renaming
  const check = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'affiliates' AND column_name = 'invite_accepted_at'
  `;

  if (check.length === 0) {
    console.log("Column 'invite_accepted_at' not found — nothing to rename.");
    return;
  }

  console.log("Renaming invite_accepted_at → inviteAcceptedAt ...");
  await sql`
    ALTER TABLE affiliates RENAME COLUMN invite_accepted_at TO "inviteAcceptedAt"
  `;

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
