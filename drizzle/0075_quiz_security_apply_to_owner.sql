-- Exam Mode audience: optional restrictions for the plan owner (owner-only toggle).
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "quizSecurityApplyToOwner" boolean NOT NULL DEFAULT false;
ALTER TABLE "decks" ADD COLUMN IF NOT EXISTS "quizSecurityApplyToOwner" boolean;
