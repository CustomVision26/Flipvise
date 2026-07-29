-- AI Essay add-on: team entitlement source, catalog seed, essay tables

DO $$ BEGIN
  ALTER TYPE "public"."addon_entitlement_source" ADD VALUE IF NOT EXISTS 'team';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "user_addon_entitlements" ADD COLUMN IF NOT EXISTS "teamId" integer;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "user_addon_entitlements_team_id_idx"
  ON "user_addon_entitlements" USING btree ("teamId");
--> statement-breakpoint

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
  "updatedAt" = now();
--> statement-breakpoint

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
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "essay_documents_user_id_idx"
  ON "essay_documents" USING btree ("userId");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "essay_documents_team_id_idx"
  ON "essay_documents" USING btree ("teamId");
--> statement-breakpoint

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
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "essay_drafts_user_id_idx"
  ON "essay_drafts" USING btree ("userId");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "essay_drafts_document_id_idx"
  ON "essay_drafts" USING btree ("documentId");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "essay_drafts_user_document_uidx"
  ON "essay_drafts" USING btree ("userId", "documentId");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "essay_feedback" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "documentId" integer NOT NULL,
  "draftId" integer NOT NULL,
  "userId" varchar(255) NOT NULL,
  "result" json NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "essay_feedback_user_id_idx"
  ON "essay_feedback" USING btree ("userId");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "essay_feedback_document_id_idx"
  ON "essay_feedback" USING btree ("documentId");
--> statement-breakpoint

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
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "essay_assignments_assignee_idx"
  ON "essay_assignments" USING btree ("assigneeUserId");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "essay_assignments_team_id_idx"
  ON "essay_assignments" USING btree ("teamId");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "essay_assignments_team_doc_assignee_uidx"
  ON "essay_assignments" USING btree ("teamId", "documentId", "assigneeUserId");
--> statement-breakpoint

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
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "essay_usage_events_user_id_idx"
  ON "essay_usage_events" USING btree ("userId");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "essay_usage_events_event_type_idx"
  ON "essay_usage_events" USING btree ("eventType");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "essay_usage_events_created_at_idx"
  ON "essay_usage_events" USING btree ("createdAt");
