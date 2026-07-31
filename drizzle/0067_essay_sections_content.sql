-- Dynamic essay builder v2: per-section draft content JSON
ALTER TABLE "essay_drafts"
  ADD COLUMN IF NOT EXISTS "sectionsContent" json DEFAULT '{}'::json NOT NULL;
