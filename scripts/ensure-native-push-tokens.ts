/**
 * Creates the native_push_tokens table (if it doesn't exist).
 * Stores FCM/APNs device tokens for Capacitor push notifications.
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log("Creating native_push_tokens table (if missing)...");
  await sql`
    CREATE TABLE IF NOT EXISTS "native_push_tokens" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "userId" varchar(255) NOT NULL,
      "token" varchar(512) NOT NULL,
      "platform" varchar(16) NOT NULL,
      "appVersion" varchar(32),
      "label" varchar(128),
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "lastUsedAt" timestamp,
      "revokedAt" timestamp,
      CONSTRAINT "native_push_tokens_token_unique" UNIQUE("token")
    )
  `;

  console.log("Ensuring indexes...");
  await sql`
    CREATE INDEX IF NOT EXISTS "native_push_tokens_user_idx"
      ON "native_push_tokens" ("userId")
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS "native_push_tokens_token_idx"
      ON "native_push_tokens" ("token")
  `;

  console.log("Done. native_push_tokens is up to date.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
