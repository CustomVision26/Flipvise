/**
 * Ensures AI Recall session card count column + inbox table exist.
 * Run: npx tsx scripts/ensure-ai-recall-session-cards.ts
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
    ALTER TABLE "teams"
    ADD COLUMN IF NOT EXISTS "aiRecallSessionCardCount" integer
  `;

  await sql`
    ALTER TABLE "decks"
    ADD COLUMN IF NOT EXISTS "aiRecallSessionCardCount" integer
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "ai_recall_result_inbox_messages" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "recipientUserId" varchar(255) NOT NULL,
      "sessionId" integer NOT NULL REFERENCES "ai_recall_sessions"("id") ON DELETE CASCADE,
      "title" varchar(200) NOT NULL,
      "description" text NOT NULL,
      "read" boolean NOT NULL DEFAULT false,
      "createdAt" timestamp NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "ai_recall_result_inbox_recipient_idx"
    ON "ai_recall_result_inbox_messages" ("recipientUserId")
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "ai_recall_result_inbox_session_idx"
    ON "ai_recall_result_inbox_messages" ("sessionId")
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "ai_recall_result_inbox_recipient_session_uidx"
    ON "ai_recall_result_inbox_messages" ("recipientUserId", "sessionId")
  `;

  console.log("AI Recall session cards + inbox schema ensured.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
