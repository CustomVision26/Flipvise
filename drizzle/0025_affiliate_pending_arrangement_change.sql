ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "pendingPlanAssigned" varchar(64);
ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "pendingEndsAt" timestamp;
ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "arrangementChangeToken" varchar(64);
ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "arrangementChangeExpiresAt" timestamp;

CREATE UNIQUE INDEX IF NOT EXISTS "affiliates_arrangementChangeToken_unique"
ON "affiliates" ("arrangementChangeToken");
