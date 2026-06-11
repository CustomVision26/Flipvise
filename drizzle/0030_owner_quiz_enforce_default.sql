ALTER TABLE "team_owner_quiz_defaults"
ADD COLUMN IF NOT EXISTS "enforce_default_for_all_workspaces" boolean NOT NULL DEFAULT false;
