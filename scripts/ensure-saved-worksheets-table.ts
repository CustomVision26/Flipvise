/**
 * Creates saved_worksheets when missing.
 * Run: npm run db:ensure-saved-worksheets-table
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { neon } from "@neondatabase/serverless";
import { resolveDatabaseUrl } from "../src/lib/resolve-database-url";

async function main() {
  const sql = neon(resolveDatabaseUrl());

  await sql`
    CREATE TABLE IF NOT EXISTS "saved_worksheets" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "userId" varchar(255) NOT NULL,
      "label" varchar(255) NOT NULL,
      "worksheetTitle" varchar(512) NOT NULL,
      "subject" varchar(255) NOT NULL,
      "gradeLevel" varchar(64) NOT NULL,
      "topic" varchar(255) NOT NULL,
      "worksheetType" varchar(64) NOT NULL,
      "difficultyLevel" varchar(32) NOT NULL,
      "deckId" integer NOT NULL,
      "sourceDeckName" varchar(255) NOT NULL,
      "input" json NOT NULL,
      "result" json NOT NULL,
      "worksheetPdfUrl" text,
      "worksheetPdfFileName" varchar(255),
      "answerKeyPdfUrl" text,
      "answerKeyPdfFileName" varchar(255),
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "saved_worksheets_user_id_idx"
    ON "saved_worksheets" ("userId")
  `;

  console.log("saved_worksheets table ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
