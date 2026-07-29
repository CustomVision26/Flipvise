/**
 * Ensures AI Essay add-on catalog row, team entitlement source, and essay tables.
 * Run: npm run db:ensure-ai-essay-addon
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
      ALTER TYPE "addon_entitlement_source" ADD VALUE IF NOT EXISTS 'team';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$
  `;

  await sql`
    ALTER TABLE "user_addon_entitlements"
    ADD COLUMN IF NOT EXISTS "teamId" integer
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "user_addon_entitlements_team_id_idx"
    ON "user_addon_entitlements" ("teamId")
  `;

  await sql`
    INSERT INTO "addon_catalog" (
      "key",
      "name",
      "description",
      "marketingBlurb",
      "eligiblePlanIds",
      "stripePriceEnvKey",
      "active",
      "publishedOnPricing"
    ) VALUES (
      'ai_essay',
      'AI Essay',
      'Generate essay activities, write drafts, submit work, and receive AI feedback.',
      'Unlock AI Essay as an optional add-on on top of your current plan — monthly or yearly.',
      '["pro","pro_plus","pro_plus_team_basic","pro_plus_team_gold","pro_plus_platinum_plan","pro_plus_enterprise","education_plus","education_gold","education_enterprise"]'::json,
      'STRIPE_ADDON_AI_ESSAY_PRICE_ID',
      true,
      false
    )
    ON CONFLICT ("key") DO UPDATE SET
      "name" = EXCLUDED."name",
      "description" = EXCLUDED."description",
      "marketingBlurb" = EXCLUDED."marketingBlurb",
      "eligiblePlanIds" = EXCLUDED."eligiblePlanIds",
      "stripePriceEnvKey" = EXCLUDED."stripePriceEnvKey",
      "updatedAt" = now()
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "essay_documents" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "userId" varchar(255) NOT NULL,
      "teamId" integer,
      "title" varchar(512) NOT NULL,
      "subject" varchar(255) NOT NULL,
      "gradeLevel" varchar(64) NOT NULL,
      "essayType" varchar(64) NOT NULL,
      "difficultyLevel" varchar(32) NOT NULL,
      "topic" varchar(512) NOT NULL,
      "learningStandard" varchar(512) DEFAULT '' NOT NULL,
      "wordCountTarget" integer NOT NULL,
      "timeLimitMinutes" integer DEFAULT 0 NOT NULL,
      "status" varchar(32) DEFAULT 'ready' NOT NULL,
      "input" json NOT NULL,
      "result" json NOT NULL,
      "modelEssayRevealed" boolean DEFAULT false NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS "essay_documents_user_id_idx" ON "essay_documents" ("userId")`;
  await sql`CREATE INDEX IF NOT EXISTS "essay_documents_team_id_idx" ON "essay_documents" ("teamId")`;

  await sql`
    CREATE TABLE IF NOT EXISTS "essay_drafts" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "documentId" integer NOT NULL,
      "userId" varchar(255) NOT NULL,
      "body" text DEFAULT '' NOT NULL,
      "wordCount" integer DEFAULT 0 NOT NULL,
      "status" varchar(32) DEFAULT 'draft' NOT NULL,
      "submittedAt" timestamp,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS "essay_drafts_user_id_idx" ON "essay_drafts" ("userId")`;
  await sql`CREATE INDEX IF NOT EXISTS "essay_drafts_document_id_idx" ON "essay_drafts" ("documentId")`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "essay_drafts_user_document_uidx" ON "essay_drafts" ("userId", "documentId")`;

  await sql`
    CREATE TABLE IF NOT EXISTS "essay_feedback" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "documentId" integer NOT NULL,
      "draftId" integer NOT NULL,
      "userId" varchar(255) NOT NULL,
      "result" json NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS "essay_feedback_user_id_idx" ON "essay_feedback" ("userId")`;
  await sql`CREATE INDEX IF NOT EXISTS "essay_feedback_document_id_idx" ON "essay_feedback" ("documentId")`;

  await sql`
    CREATE TABLE IF NOT EXISTS "essay_assignments" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "teamId" integer NOT NULL,
      "documentId" integer NOT NULL,
      "assigneeUserId" varchar(255) NOT NULL,
      "assignedByUserId" varchar(255) NOT NULL,
      "status" varchar(32) DEFAULT 'assigned' NOT NULL,
      "dueAt" timestamp,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS "essay_assignments_assignee_idx" ON "essay_assignments" ("assigneeUserId")`;
  await sql`CREATE INDEX IF NOT EXISTS "essay_assignments_team_id_idx" ON "essay_assignments" ("teamId")`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "essay_assignments_team_doc_assignee_uidx" ON "essay_assignments" ("teamId", "documentId", "assigneeUserId")`;

  await sql`
    CREATE TABLE IF NOT EXISTS "essay_usage_events" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "userId" varchar(255) NOT NULL,
      "addonKey" varchar(128) DEFAULT 'ai_essay' NOT NULL,
      "eventType" varchar(64) NOT NULL,
      "documentId" integer,
      "draftId" integer,
      "tokensUsed" integer DEFAULT 0 NOT NULL,
      "metadata" json,
      "createdAt" timestamp DEFAULT now() NOT NULL
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS "essay_usage_events_user_id_idx" ON "essay_usage_events" ("userId")`;
  await sql`CREATE INDEX IF NOT EXISTS "essay_usage_events_event_type_idx" ON "essay_usage_events" ("eventType")`;
  await sql`CREATE INDEX IF NOT EXISTS "essay_usage_events_created_at_idx" ON "essay_usage_events" ("createdAt")`;

  const check = await sql`
    SELECT to_regclass('public.essay_documents') AS essay_documents,
           to_regclass('public.essay_drafts') AS essay_drafts,
           (SELECT count(*)::int FROM addon_catalog WHERE key = 'ai_essay') AS ai_essay_seeded
  `;
  console.log("AI Essay add-on ready:", check[0]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
