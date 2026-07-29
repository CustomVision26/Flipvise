CREATE TYPE "public"."ai_usage_feature" AS ENUM('flashcards', 'quiz', 'lesson_plan', 'essay', 'study_guide', 'passage', 'ai_recall', 'homework', 'worksheet', 'documentation', 'tts', 'ocr', 'curriculum_research', 'image_generation', 'other');--> statement-breakpoint
CREATE TYPE "public"."ai_usage_status" AS ENUM('success', 'failed', 'blocked', 'timed_out');--> statement-breakpoint
CREATE TABLE "ai_usage_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_usage_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" varchar(255) NOT NULL,
	"teamId" integer,
	"subscriptionPlan" varchar(64),
	"feature" "ai_usage_feature" NOT NULL,
	"model" varchar(128) NOT NULL,
	"provider" varchar(64) DEFAULT 'openai' NOT NULL,
	"inputTokens" integer DEFAULT 0 NOT NULL,
	"outputTokens" integer DEFAULT 0 NOT NULL,
	"cachedInputTokens" integer DEFAULT 0 NOT NULL,
	"totalTokens" integer DEFAULT 0 NOT NULL,
	"estimatedCostMicros" integer DEFAULT 0 NOT NULL,
	"currency" varchar(8) DEFAULT 'usd' NOT NULL,
	"pricingVersion" varchar(64) DEFAULT '2026-07-01' NOT NULL,
	"status" "ai_usage_status" NOT NULL,
	"responseTimeMs" integer,
	"providerRequestId" varchar(255),
	"errorCode" varchar(128),
	"errorCategory" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_period_counters" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_usage_period_counters_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" varchar(255) NOT NULL,
	"periodStart" timestamp NOT NULL,
	"periodEnd" timestamp NOT NULL,
	"generationCount" integer DEFAULT 0 NOT NULL,
	"resetAdjustment" integer DEFAULT 0 NOT NULL,
	"inputTokens" integer DEFAULT 0 NOT NULL,
	"outputTokens" integer DEFAULT 0 NOT NULL,
	"totalTokens" integer DEFAULT 0 NOT NULL,
	"estimatedCostMicros" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_user_limits" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_usage_user_limits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" varchar(255) NOT NULL,
	"monthlyAllowance" integer,
	"unlimited" boolean DEFAULT false NOT NULL,
	"aiAccessEnabled" boolean DEFAULT true NOT NULL,
	"warningThreshold80" boolean DEFAULT true NOT NULL,
	"warningThreshold90" boolean DEFAULT true NOT NULL,
	"warningThreshold100" boolean DEFAULT true NOT NULL,
	"blockAtLimit" boolean DEFAULT true NOT NULL,
	"allowOverage" boolean DEFAULT false NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"flagReason" text,
	"notes" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"updatedByUserId" varchar(255),
	CONSTRAINT "ai_usage_user_limits_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "ai_usage_team_limits" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_usage_team_limits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"teamId" integer NOT NULL,
	"monthlyAllowance" integer,
	"unlimited" boolean DEFAULT false NOT NULL,
	"aiAccessEnabled" boolean DEFAULT true NOT NULL,
	"blockAtLimit" boolean DEFAULT true NOT NULL,
	"allowOverage" boolean DEFAULT false NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"updatedByUserId" varchar(255),
	CONSTRAINT "ai_usage_team_limits_teamId_unique" UNIQUE("teamId")
);
--> statement-breakpoint
CREATE TABLE "ai_usage_admin_audit_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_usage_admin_audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"actorUserId" varchar(255) NOT NULL,
	"actorName" varchar(255) NOT NULL,
	"targetUserId" varchar(255),
	"targetTeamId" integer,
	"action" varchar(64) NOT NULL,
	"previousValue" json,
	"newValue" json,
	"reason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_teamId_teams_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_team_limits" ADD CONSTRAINT "ai_usage_team_limits_teamId_teams_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_events_user_created_idx" ON "ai_usage_events" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "ai_usage_events_team_created_idx" ON "ai_usage_events" USING btree ("teamId","createdAt");--> statement-breakpoint
CREATE INDEX "ai_usage_events_feature_created_idx" ON "ai_usage_events" USING btree ("feature","createdAt");--> statement-breakpoint
CREATE INDEX "ai_usage_events_model_created_idx" ON "ai_usage_events" USING btree ("model","createdAt");--> statement-breakpoint
CREATE INDEX "ai_usage_events_status_created_idx" ON "ai_usage_events" USING btree ("status","createdAt");--> statement-breakpoint
CREATE INDEX "ai_usage_events_created_at_idx" ON "ai_usage_events" USING btree ("createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_period_counters_user_period_uidx" ON "ai_usage_period_counters" USING btree ("userId","periodStart");--> statement-breakpoint
CREATE INDEX "ai_usage_period_counters_period_idx" ON "ai_usage_period_counters" USING btree ("periodStart","periodEnd");--> statement-breakpoint
CREATE INDEX "ai_usage_user_limits_user_id_idx" ON "ai_usage_user_limits" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "ai_usage_team_limits_team_id_idx" ON "ai_usage_team_limits" USING btree ("teamId");--> statement-breakpoint
CREATE INDEX "ai_usage_admin_audit_logs_actor_idx" ON "ai_usage_admin_audit_logs" USING btree ("actorUserId");--> statement-breakpoint
CREATE INDEX "ai_usage_admin_audit_logs_target_user_idx" ON "ai_usage_admin_audit_logs" USING btree ("targetUserId");--> statement-breakpoint
CREATE INDEX "ai_usage_admin_audit_logs_created_at_idx" ON "ai_usage_admin_audit_logs" USING btree ("createdAt");
