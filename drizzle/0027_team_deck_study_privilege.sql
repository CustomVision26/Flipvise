DO $$ BEGIN
  CREATE TYPE "public"."team_member_study_privilege" AS ENUM('standard_review', 'quiz', 'both');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "team_deck_assignments"
  ADD COLUMN IF NOT EXISTS "studyPrivilege" "team_member_study_privilege" DEFAULT 'both' NOT NULL;
