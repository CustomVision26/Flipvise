ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "inactiveAt" timestamp;
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "inactiveAt" timestamp;
ALTER TABLE "decks" ADD COLUMN IF NOT EXISTS "inactiveAt" timestamp;

DO $$ BEGIN
  CREATE TYPE "plan_reconciliation_status" AS ENUM('pending', 'completed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "plan_reconciliation_trigger" AS ENUM('upgrade', 'downgrade', 'lateral');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "plan_reconciliation_sessions" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "userId" varchar(255) NOT NULL,
  "targetPlanSlug" varchar(64) NOT NULL,
  "previousPlanSlug" varchar(64),
  "triggerKind" "plan_reconciliation_trigger" NOT NULL DEFAULT 'lateral',
  "status" "plan_reconciliation_status" NOT NULL DEFAULT 'pending',
  "snapshot" json NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "completedAt" timestamp
);

CREATE INDEX IF NOT EXISTS "plan_reconciliation_sessions_user_status_idx"
  ON "plan_reconciliation_sessions" ("userId", "status");
