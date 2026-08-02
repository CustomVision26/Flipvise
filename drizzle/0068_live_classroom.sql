-- Live Classroom™ organization add-on: catalog seed + session tables

DO $$ BEGIN
  ALTER TYPE "public"."ai_usage_feature" ADD VALUE IF NOT EXISTS 'live_classroom';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."live_classroom_session_status" AS ENUM(
    'scheduled', 'lobby', 'active', 'paused', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."live_classroom_session_type" AS ENUM(
    'warm_up', 'team_battle', 'exit_ticket', 'review_battle'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."live_classroom_battle_mode" AS ENUM(
    'individual_team', 'collaborative_team', 'survival'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."live_classroom_team_assignment" AS ENUM(
    'manual', 'random', 'saved_groups'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."live_classroom_captain_mode" AS ENUM(
    'rotation', 'random', 'fixed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."live_classroom_strategy_card_kind" AS ENUM(
    'double_points', 'extra_time', 'fifty_fifty', 'shield', 'ai_hint',
    'score_boost', 'recovery'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."live_classroom_strategy_card_policy" AS ENUM(
    'unlimited', 'limited', 'disabled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."live_classroom_difficulty" AS ENUM(
    'easy', 'medium', 'hard'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."live_classroom_org_role" AS ENUM(
    'subscription_owner', 'team_administrator', 'teacher', 'student'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

INSERT INTO "addon_catalog" (
  "key",
  "name",
  "description",
  "marketingBlurb",
  "eligiblePlanIds",
  "stripePriceEnvKey",
  "active",
  "publishedOnPricing",
  "publishedOnBanner"
) VALUES (
  'live_classroom',
  'Flipvise Live Classroom™',
  'Run real-time interactive learning sessions with warm-up battles, team competitions, exit tickets, strategy cards, and AI session reports. Participant limits inherit your organization licensed seats.',
  'Turn Flipvise into a live teaching platform — Zoom + Kahoot + Flipvise AI for Team and Enterprise organizations.',
  '["pro_plus_team_basic","pro_plus_team_gold","pro_plus_platinum_plan","pro_plus_enterprise","education_gold","education_enterprise"]'::json,
  'STRIPE_ADDON_LIVE_CLASSROOM_PRICE_ID',
  true,
  false,
  true
)
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "marketingBlurb" = EXCLUDED."marketingBlurb",
  "eligiblePlanIds" = EXCLUDED."eligiblePlanIds",
  "stripePriceEnvKey" = EXCLUDED."stripePriceEnvKey",
  "updatedAt" = now();
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "live_classroom_team_settings" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "teamId" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
  "enabled" boolean DEFAULT true NOT NULL,
  "defaultBattleType" "live_classroom_session_type" DEFAULT 'warm_up' NOT NULL,
  "allowMusic" boolean DEFAULT false NOT NULL,
  "allowStrategyCards" boolean DEFAULT true NOT NULL,
  "allowAiExplanations" boolean DEFAULT true NOT NULL,
  "defaultTeamAssignment" "live_classroom_team_assignment" DEFAULT 'random' NOT NULL,
  "maxConcurrentSessions" integer DEFAULT 1 NOT NULL,
  "strategyCardPolicy" "live_classroom_strategy_card_policy" DEFAULT 'limited' NOT NULL,
  "strategyCardLimitPerTeam" integer DEFAULT 2 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "live_classroom_team_settings_team_uidx"
  ON "live_classroom_team_settings" USING btree ("teamId");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "live_classroom_teacher_grants" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "teamId" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
  "userId" varchar(255) NOT NULL,
  "grantedByUserId" varchar(255) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "live_classroom_teacher_grants_team_user_uidx"
  ON "live_classroom_teacher_grants" USING btree ("teamId", "userId");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "live_classroom_teacher_grants_user_idx"
  ON "live_classroom_teacher_grants" USING btree ("userId");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "live_classroom_saved_groups" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "teamId" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
  "name" varchar(255) NOT NULL,
  "groups" json DEFAULT '[]'::json NOT NULL,
  "createdByUserId" varchar(255) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "live_classroom_saved_groups_team_idx"
  ON "live_classroom_saved_groups" USING btree ("teamId");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "live_classroom_sessions" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "teamId" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
  "hostUserId" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "status" "live_classroom_session_status" DEFAULT 'lobby' NOT NULL,
  "sessionType" "live_classroom_session_type" DEFAULT 'warm_up' NOT NULL,
  "battleMode" "live_classroom_battle_mode" DEFAULT 'individual_team' NOT NULL,
  "deckId" integer REFERENCES "decks"("id") ON DELETE set null,
  "savedGroupId" integer,
  "config" json NOT NULL,
  "currentQuestionIndex" integer DEFAULT 0 NOT NULL,
  "questionStartedAt" timestamp,
  "musicMuted" boolean DEFAULT false NOT NULL,
  "teamsLocked" boolean DEFAULT false NOT NULL,
  "scheduledFor" timestamp,
  "startedAt" timestamp,
  "endedAt" timestamp,
  "joinCode" varchar(16) NOT NULL,
  "extensions" json DEFAULT '{}'::json NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "live_classroom_sessions_team_status_idx"
  ON "live_classroom_sessions" USING btree ("teamId", "status");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "live_classroom_sessions_host_idx"
  ON "live_classroom_sessions" USING btree ("hostUserId");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "live_classroom_sessions_join_code_uidx"
  ON "live_classroom_sessions" USING btree ("joinCode");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "live_classroom_teams" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "sessionId" integer NOT NULL REFERENCES "live_classroom_sessions"("id") ON DELETE cascade,
  "name" varchar(128) NOT NULL,
  "colorKey" varchar(32) DEFAULT 'blue' NOT NULL,
  "score" integer DEFAULT 0 NOT NULL,
  "hearts" integer DEFAULT 3 NOT NULL,
  "eliminated" boolean DEFAULT false NOT NULL,
  "captainUserId" varchar(255),
  "sortOrder" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "live_classroom_teams_session_idx"
  ON "live_classroom_teams" USING btree ("sessionId");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "live_classroom_participants" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "sessionId" integer NOT NULL REFERENCES "live_classroom_sessions"("id") ON DELETE cascade,
  "userId" varchar(255) NOT NULL,
  "displayName" varchar(255) DEFAULT '' NOT NULL,
  "liveTeamId" integer REFERENCES "live_classroom_teams"("id") ON DELETE set null,
  "connected" boolean DEFAULT true NOT NULL,
  "lastSeenAt" timestamp DEFAULT now() NOT NULL,
  "correctCount" integer DEFAULT 0 NOT NULL,
  "incorrectCount" integer DEFAULT 0 NOT NULL,
  "totalResponseTimeMs" integer DEFAULT 0 NOT NULL,
  "answersSubmitted" integer DEFAULT 0 NOT NULL,
  "removed" boolean DEFAULT false NOT NULL,
  "joinedAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "live_classroom_participants_session_user_uidx"
  ON "live_classroom_participants" USING btree ("sessionId", "userId");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "live_classroom_participants_user_idx"
  ON "live_classroom_participants" USING btree ("userId");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "live_battle_questions" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "sessionId" integer NOT NULL REFERENCES "live_classroom_sessions"("id") ON DELETE cascade,
  "sortOrder" integer DEFAULT 0 NOT NULL,
  "prompt" text NOT NULL,
  "choices" json DEFAULT '[]'::json NOT NULL,
  "correctIndex" integer DEFAULT 0 NOT NULL,
  "explanation" text DEFAULT '' NOT NULL,
  "distractorExplanations" json DEFAULT '[]'::json NOT NULL,
  "topic" varchar(255) DEFAULT '' NOT NULL,
  "cardId" integer REFERENCES "cards"("id") ON DELETE set null,
  "media" json DEFAULT '{"kind":"none"}'::json NOT NULL,
  "revealed" boolean DEFAULT false NOT NULL,
  "aiExplanationShown" boolean DEFAULT false NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "live_battle_questions_session_idx"
  ON "live_battle_questions" USING btree ("sessionId");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "live_battle_questions_session_order_uidx"
  ON "live_battle_questions" USING btree ("sessionId", "sortOrder");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "live_battle_answers" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "sessionId" integer NOT NULL REFERENCES "live_classroom_sessions"("id") ON DELETE cascade,
  "questionId" integer NOT NULL REFERENCES "live_battle_questions"("id") ON DELETE cascade,
  "userId" varchar(255) NOT NULL,
  "liveTeamId" integer REFERENCES "live_classroom_teams"("id") ON DELETE set null,
  "choiceIndex" integer NOT NULL,
  "correct" boolean DEFAULT false NOT NULL,
  "pointsAwarded" integer DEFAULT 0 NOT NULL,
  "speedBonus" integer DEFAULT 0 NOT NULL,
  "responseTimeMs" integer DEFAULT 0 NOT NULL,
  "submittedAsCaptain" boolean DEFAULT false NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "live_battle_answers_question_user_uidx"
  ON "live_battle_answers" USING btree ("questionId", "userId");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "live_battle_answers_session_idx"
  ON "live_battle_answers" USING btree ("sessionId");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "live_battle_strategy_cards" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "sessionId" integer NOT NULL REFERENCES "live_classroom_sessions"("id") ON DELETE cascade,
  "liveTeamId" integer NOT NULL REFERENCES "live_classroom_teams"("id") ON DELETE cascade,
  "kind" "live_classroom_strategy_card_kind" NOT NULL,
  "usedByUserId" varchar(255),
  "questionId" integer REFERENCES "live_battle_questions"("id") ON DELETE set null,
  "usedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "live_battle_strategy_cards_session_idx"
  ON "live_battle_strategy_cards" USING btree ("sessionId");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "live_battle_reports" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "sessionId" integer NOT NULL REFERENCES "live_classroom_sessions"("id") ON DELETE cascade,
  "teamId" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
  "hostUserId" varchar(255) NOT NULL,
  "sessionName" varchar(255) NOT NULL,
  "stats" json NOT NULL,
  "winnerTeamName" varchar(128),
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "live_battle_reports_session_uidx"
  ON "live_battle_reports" USING btree ("sessionId");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "live_battle_reports_team_idx"
  ON "live_battle_reports" USING btree ("teamId");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "live_battle_reports_host_idx"
  ON "live_battle_reports" USING btree ("hostUserId");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "live_teacher_analytics" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "teamId" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
  "teacherUserId" varchar(255) NOT NULL,
  "sessionsHosted" integer DEFAULT 0 NOT NULL,
  "totalAttendance" integer DEFAULT 0 NOT NULL,
  "averageAccuracyPercent" integer DEFAULT 0 NOT NULL,
  "battleWins" integer DEFAULT 0 NOT NULL,
  "strategyCardsUsed" integer DEFAULT 0 NOT NULL,
  "lastSessionAt" timestamp,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "live_teacher_analytics_team_teacher_uidx"
  ON "live_teacher_analytics" USING btree ("teamId", "teacherUserId");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "live_organization_analytics" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "teamId" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
  "totalSessions" integer DEFAULT 0 NOT NULL,
  "totalAttendance" integer DEFAULT 0 NOT NULL,
  "averageAttendance" integer DEFAULT 0 NOT NULL,
  "averageAccuracyPercent" integer DEFAULT 0 NOT NULL,
  "averageResponseTimeSec" integer DEFAULT 0 NOT NULL,
  "mostActiveTeacherUserId" varchar(255),
  "strategyCardsUsed" integer DEFAULT 0 NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "live_organization_analytics_team_uidx"
  ON "live_organization_analytics" USING btree ("teamId");
