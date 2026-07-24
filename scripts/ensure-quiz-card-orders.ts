/**
 * Creates quiz card order table/columns when missing.
 * Run: npm run db:ensure-quiz-card-orders
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
    ALTER TABLE "decks"
    ADD COLUMN IF NOT EXISTS "quizCardOrderShuffledAt" timestamp
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS "quiz_card_orders" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "teamId" integer NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
      "deckId" integer NOT NULL REFERENCES "decks"("id") ON DELETE CASCADE,
      "viewerUserId" varchar(255) NOT NULL,
      "cardIds" json NOT NULL,
      "shuffledAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "quiz_card_orders_team_deck_viewer_uidx"
    ON "quiz_card_orders" ("teamId", "deckId", "viewerUserId")
  `;
  console.log("Quiz card order schema is present (created or already existed).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
