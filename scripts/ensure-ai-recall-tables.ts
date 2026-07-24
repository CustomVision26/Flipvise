/**
 * Creates AI Recall™ tables/enums when missing.
 * Run: npm run db:ensure-ai-recall-tables
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
    DO $$ BEGIN
      CREATE TYPE "card_mastery_level" AS ENUM (
        'new',
        'learning',
        'strong',
        'mastered'
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "card_mastery" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "userId" varchar(255) NOT NULL,
      "cardId" integer NOT NULL REFERENCES "cards"("id") ON DELETE CASCADE,
      "deckId" integer NOT NULL REFERENCES "decks"("id") ON DELETE CASCADE,
      "level" "card_mastery_level" NOT NULL DEFAULT 'new',
      "lastScore" integer,
      "lastOutcome" varchar(32),
      "correctStreak" integer NOT NULL DEFAULT 0,
      "reviewCount" integer NOT NULL DEFAULT 0,
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "card_mastery_user_card_uidx"
    ON "card_mastery" ("userId", "cardId")
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "card_mastery_user_deck_idx"
    ON "card_mastery" ("userId", "deckId")
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "ai_recall_sessions" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "userId" varchar(255) NOT NULL,
      "deckId" integer REFERENCES "decks"("id") ON DELETE SET NULL,
      "deckName" varchar(255) NOT NULL,
      "teamId" integer REFERENCES "teams"("id") ON DELETE SET NULL,
      "cardsReviewed" integer NOT NULL,
      "correct" integer NOT NULL,
      "incorrect" integer NOT NULL,
      "forcedUnlocks" integer NOT NULL DEFAULT 0,
      "averageRecallTimeMs" integer NOT NULL DEFAULT 0,
      "averageAiScore" integer,
      "masteredCards" integer NOT NULL DEFAULT 0,
      "needsReview" integer NOT NULL DEFAULT 0,
      "sessionDurationMs" integer NOT NULL DEFAULT 0,
      "perCard" json,
      "savedAt" timestamp NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "ai_recall_sessions_user_id_idx"
    ON "ai_recall_sessions" ("userId")
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "ai_recall_sessions_team_id_idx"
    ON "ai_recall_sessions" ("teamId")
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "ai_recall_sessions_deck_id_idx"
    ON "ai_recall_sessions" ("deckId")
  `;

  console.log("AI Recall tables ensured.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
