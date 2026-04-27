/**
 * Applies the affiliate invite flow schema changes:
 *   - Adds 'pending' to affiliate_status enum
 *   - Adds token (unique, nullable) column
 *   - Adds invite_accepted_at column
 *   - Resets the default status from 'active' to 'pending'
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log("Adding 'pending' value to affiliate_status enum...");
  await sql`
    DO $$ BEGIN
      ALTER TYPE affiliate_status ADD VALUE IF NOT EXISTS 'pending';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `;

  console.log("Adding token column (unique, nullable)...");
  await sql`
    ALTER TABLE affiliates
    ADD COLUMN IF NOT EXISTS token varchar(64) UNIQUE
  `;

  console.log("Adding inviteAcceptedAt column...");
  await sql`
    ALTER TABLE affiliates
    ADD COLUMN IF NOT EXISTS "inviteAcceptedAt" timestamp
  `;

  console.log("Updating default status to 'pending'...");
  await sql`
    ALTER TABLE affiliates ALTER COLUMN status SET DEFAULT 'pending'
  `;

  console.log("Done. Schema is up to date.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
