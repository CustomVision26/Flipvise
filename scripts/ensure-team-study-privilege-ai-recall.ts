/**
 * Adds AI Recall™ values to team_member_study_privilege and remaps legacy rows.
 * Run: npm run db:ensure-team-study-privilege-ai-recall
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
      ALTER TYPE "public"."team_member_study_privilege" ADD VALUE 'ai_recall';
    EXCEPTION WHEN duplicate_object THEN null;
    END $$
  `;
  await sql`
    DO $$ BEGIN
      ALTER TYPE "public"."team_member_study_privilege" ADD VALUE 'review_and_ai_recall';
    EXCEPTION WHEN duplicate_object THEN null;
    END $$
  `;
  await sql`
    DO $$ BEGIN
      ALTER TYPE "public"."team_member_study_privilege" ADD VALUE 'ai_recall_and_quiz';
    EXCEPTION WHEN duplicate_object THEN null;
    END $$
  `;
  await sql`
    DO $$ BEGIN
      ALTER TYPE "public"."team_member_study_privilege" ADD VALUE 'all';
    EXCEPTION WHEN duplicate_object THEN null;
    END $$
  `;

  await sql`
    UPDATE "team_deck_assignments"
    SET "studyPrivilege" = 'all'
    WHERE "studyPrivilege" = 'both'
  `;

  await sql`
    UPDATE "team_deck_assignments"
    SET "studyPrivilege" = 'review_and_ai_recall'
    WHERE "studyPrivilege" = 'standard_review'
  `;

  await sql`
    ALTER TABLE "team_deck_assignments"
    ALTER COLUMN "studyPrivilege" SET DEFAULT 'all'
  `;

  console.log("team_member_study_privilege AI Recall values ensured.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
