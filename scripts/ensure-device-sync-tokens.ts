/**
 * Creates the device_sync_tokens table (if it doesn't exist).
 * Used by the offline mobile app to authenticate to /api/sync with a long-lived token.
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log("Creating device_sync_tokens table (if missing)...");
  await sql`
    CREATE TABLE IF NOT EXISTS "device_sync_tokens" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "userId" varchar(255) NOT NULL,
      "tokenHash" varchar(64) NOT NULL,
      "label" varchar(128),
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "lastUsedAt" timestamp,
      "revokedAt" timestamp,
      CONSTRAINT "device_sync_tokens_tokenHash_unique" UNIQUE("tokenHash")
    )
  `;

  console.log("Ensuring user index...");
  await sql`
    CREATE INDEX IF NOT EXISTS "device_sync_tokens_user_idx"
      ON "device_sync_tokens" ("userId")
  `;

  console.log("Done. device_sync_tokens is up to date.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
