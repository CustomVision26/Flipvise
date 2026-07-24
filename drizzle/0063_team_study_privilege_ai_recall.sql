-- Expand team_member_study_privilege for AI Recall™ assignment options.
ALTER TYPE "public"."team_member_study_privilege" ADD VALUE IF NOT EXISTS 'ai_recall';
ALTER TYPE "public"."team_member_study_privilege" ADD VALUE IF NOT EXISTS 'review_and_ai_recall';
ALTER TYPE "public"."team_member_study_privilege" ADD VALUE IF NOT EXISTS 'ai_recall_and_quiz';
ALTER TYPE "public"."team_member_study_privilege" ADD VALUE IF NOT EXISTS 'all';

-- Preserve prior effective access: "both" and "standard_review" previously
-- surfaced AI Recall whenever Standard Review was allowed.
UPDATE "team_deck_assignments"
SET "studyPrivilege" = 'all'
WHERE "studyPrivilege" = 'both';

UPDATE "team_deck_assignments"
SET "studyPrivilege" = 'review_and_ai_recall'
WHERE "studyPrivilege" = 'standard_review';

ALTER TABLE "team_deck_assignments"
  ALTER COLUMN "studyPrivilege" SET DEFAULT 'all';
