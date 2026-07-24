/**

 * Creates quiz security tables/columns when missing.

 * Run: npm run db:ensure-quiz-security-tables

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

    ADD COLUMN IF NOT EXISTS "quizSecurityEnabled" boolean NOT NULL DEFAULT false

  `;



  await sql`

    DO $$ BEGIN

      CREATE TYPE "quiz_security_session_status" AS ENUM (

        'active',

        'locked',

        'granted_resume',

        'terminated',

        'completed'

      );

    EXCEPTION

      WHEN duplicate_object THEN NULL;

    END $$

  `;



  await sql`

    CREATE TABLE IF NOT EXISTS "quiz_security_sessions" (

      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

      "userId" varchar(255) NOT NULL,

      "teamId" integer NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,

      "deckId" integer REFERENCES "decks"("id") ON DELETE SET NULL,

      "deckName" varchar(255) NOT NULL,

      "status" "quiz_security_session_status" NOT NULL DEFAULT 'active',

      "sessionState" json,

      "lockedAt" timestamp,

      "terminatedAt" timestamp,

      "completedAt" timestamp,

      "createdAt" timestamp NOT NULL DEFAULT now(),

      "updatedAt" timestamp NOT NULL DEFAULT now()

    )

  `;



  await sql`

    CREATE INDEX IF NOT EXISTS "quiz_security_sessions_team_status_idx"

    ON "quiz_security_sessions" ("teamId", "status")

  `;



  await sql`

    CREATE INDEX IF NOT EXISTS "quiz_security_sessions_user_deck_idx"

    ON "quiz_security_sessions" ("userId", "deckId")

  `;



  await sql`

    CREATE TABLE IF NOT EXISTS "quiz_security_inbox_messages" (

      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

      "recipientUserId" varchar(255) NOT NULL,

      "sessionId" integer NOT NULL REFERENCES "quiz_security_sessions"("id") ON DELETE CASCADE,

      "read" boolean NOT NULL DEFAULT false,

      "createdAt" timestamp NOT NULL DEFAULT now()

    )

  `;



  await sql`

    CREATE INDEX IF NOT EXISTS "quiz_security_inbox_recipient_idx"

    ON "quiz_security_inbox_messages" ("recipientUserId")

  `;



  await sql`
    ALTER TABLE "teams"
    ADD COLUMN IF NOT EXISTS "quizSecurityApplyToMembers" boolean NOT NULL DEFAULT true
  `;
  await sql`
    ALTER TABLE "teams"
    ADD COLUMN IF NOT EXISTS "quizSecurityApplyToTeamAdmins" boolean NOT NULL DEFAULT false
  `;
  await sql`
    ALTER TABLE "decks"
    ADD COLUMN IF NOT EXISTS "quizSecurityApplyToMembers" boolean
  `;
  await sql`
    ALTER TABLE "decks"
    ADD COLUMN IF NOT EXISTS "quizSecurityApplyToTeamAdmins" boolean
  `;

  console.log("Quiz security schema is present (created or already existed).");

}



main().catch((e) => {

  console.error(e);

  process.exit(1);

});


