-- Whom quiz security applies to (plan owner is always restricted when security is on).
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "quizSecurityApplyToMembers" boolean NOT NULL DEFAULT true;
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "quizSecurityApplyToTeamAdmins" boolean NOT NULL DEFAULT false;

ALTER TABLE "decks" ADD COLUMN IF NOT EXISTS "quizSecurityApplyToMembers" boolean;
ALTER TABLE "decks" ADD COLUMN IF NOT EXISTS "quizSecurityApplyToTeamAdmins" boolean;
