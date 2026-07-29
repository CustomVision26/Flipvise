/**
 * Creates AI usage analytics tables/enums when missing.
 * Run: npm run db:ensure-ai-usage-tables
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
      CREATE TYPE "ai_usage_feature" AS ENUM (
        'flashcards',
        'quiz',
        'lesson_plan',
        'essay',
        'study_guide',
        'passage',
        'ai_recall',
        'homework',
        'worksheet',
        'documentation',
        'tts',
        'ocr',
        'curriculum_research',
        'image_generation',
        'other'
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$
  `;

  await sql`
    DO $$ BEGIN
      CREATE TYPE "ai_usage_status" AS ENUM (
        'success',
        'failed',
        'blocked',
        'timed_out'
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "ai_usage_events" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "userId" varchar(255) NOT NULL,
      "teamId" integer REFERENCES "teams"("id") ON DELETE SET NULL,
      "subscriptionPlan" varchar(64),
      "feature" "ai_usage_feature" NOT NULL,
      "model" varchar(128) NOT NULL,
      "provider" varchar(64) NOT NULL DEFAULT 'openai',
      "inputTokens" integer NOT NULL DEFAULT 0,
      "outputTokens" integer NOT NULL DEFAULT 0,
      "cachedInputTokens" integer NOT NULL DEFAULT 0,
      "totalTokens" integer NOT NULL DEFAULT 0,
      "estimatedCostMicros" integer NOT NULL DEFAULT 0,
      "currency" varchar(8) NOT NULL DEFAULT 'usd',
      "pricingVersion" varchar(64) NOT NULL DEFAULT '2026-07-01',
      "status" "ai_usage_status" NOT NULL,
      "responseTimeMs" integer,
      "providerRequestId" varchar(255),
      "errorCode" varchar(128),
      "errorCategory" varchar(64),
      "createdAt" timestamp NOT NULL DEFAULT now()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS "ai_usage_events_user_created_idx" ON "ai_usage_events" ("userId", "createdAt")`;
  await sql`CREATE INDEX IF NOT EXISTS "ai_usage_events_team_created_idx" ON "ai_usage_events" ("teamId", "createdAt")`;
  await sql`CREATE INDEX IF NOT EXISTS "ai_usage_events_feature_created_idx" ON "ai_usage_events" ("feature", "createdAt")`;
  await sql`CREATE INDEX IF NOT EXISTS "ai_usage_events_model_created_idx" ON "ai_usage_events" ("model", "createdAt")`;
  await sql`CREATE INDEX IF NOT EXISTS "ai_usage_events_status_created_idx" ON "ai_usage_events" ("status", "createdAt")`;
  await sql`CREATE INDEX IF NOT EXISTS "ai_usage_events_created_at_idx" ON "ai_usage_events" ("createdAt")`;

  await sql`
    CREATE TABLE IF NOT EXISTS "ai_usage_period_counters" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "userId" varchar(255) NOT NULL,
      "periodStart" timestamp NOT NULL,
      "periodEnd" timestamp NOT NULL,
      "generationCount" integer NOT NULL DEFAULT 0,
      "resetAdjustment" integer NOT NULL DEFAULT 0,
      "inputTokens" integer NOT NULL DEFAULT 0,
      "outputTokens" integer NOT NULL DEFAULT 0,
      "totalTokens" integer NOT NULL DEFAULT 0,
      "estimatedCostMicros" integer NOT NULL DEFAULT 0,
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )
  `;

  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "ai_usage_period_counters_user_period_uidx" ON "ai_usage_period_counters" ("userId", "periodStart")`;
  await sql`CREATE INDEX IF NOT EXISTS "ai_usage_period_counters_period_idx" ON "ai_usage_period_counters" ("periodStart", "periodEnd")`;

  await sql`
    CREATE TABLE IF NOT EXISTS "ai_usage_user_limits" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "userId" varchar(255) NOT NULL UNIQUE,
      "monthlyAllowance" integer,
      "unlimited" boolean NOT NULL DEFAULT false,
      "aiAccessEnabled" boolean NOT NULL DEFAULT true,
      "warningThreshold80" boolean NOT NULL DEFAULT true,
      "warningThreshold90" boolean NOT NULL DEFAULT true,
      "warningThreshold100" boolean NOT NULL DEFAULT true,
      "blockAtLimit" boolean NOT NULL DEFAULT true,
      "allowOverage" boolean NOT NULL DEFAULT false,
      "flagged" boolean NOT NULL DEFAULT false,
      "flagReason" text,
      "notes" text,
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      "updatedByUserId" varchar(255)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS "ai_usage_user_limits_user_id_idx" ON "ai_usage_user_limits" ("userId")`;

  await sql`
    CREATE TABLE IF NOT EXISTS "ai_usage_team_limits" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "teamId" integer NOT NULL UNIQUE REFERENCES "teams"("id") ON DELETE CASCADE,
      "monthlyAllowance" integer,
      "unlimited" boolean NOT NULL DEFAULT false,
      "aiAccessEnabled" boolean NOT NULL DEFAULT true,
      "blockAtLimit" boolean NOT NULL DEFAULT true,
      "allowOverage" boolean NOT NULL DEFAULT false,
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      "updatedByUserId" varchar(255)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS "ai_usage_team_limits_team_id_idx" ON "ai_usage_team_limits" ("teamId")`;

  await sql`
    CREATE TABLE IF NOT EXISTS "ai_usage_admin_audit_logs" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "actorUserId" varchar(255) NOT NULL,
      "actorName" varchar(255) NOT NULL,
      "targetUserId" varchar(255),
      "targetTeamId" integer,
      "action" varchar(64) NOT NULL,
      "previousValue" json,
      "newValue" json,
      "reason" text,
      "createdAt" timestamp NOT NULL DEFAULT now()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS "ai_usage_admin_audit_logs_actor_idx" ON "ai_usage_admin_audit_logs" ("actorUserId")`;
  await sql`CREATE INDEX IF NOT EXISTS "ai_usage_admin_audit_logs_target_user_idx" ON "ai_usage_admin_audit_logs" ("targetUserId")`;
  await sql`CREATE INDEX IF NOT EXISTS "ai_usage_admin_audit_logs_created_at_idx" ON "ai_usage_admin_audit_logs" ("createdAt")`;

  console.log("AI usage analytics tables ensured.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
