-- Background artwork rotation schedule on user appearance preferences.
-- Safe to re-run. Does not update or delete existing preference values
-- other than filling the new columns with their defaults.

ALTER TABLE "user_appearance_preferences"
  ADD COLUMN IF NOT EXISTS "backgroundChangeEnabled" boolean DEFAULT true NOT NULL;

ALTER TABLE "user_appearance_preferences"
  ADD COLUMN IF NOT EXISTS "backgroundChangeHours" integer DEFAULT 24 NOT NULL;

ALTER TABLE "user_appearance_preferences"
  ADD COLUMN IF NOT EXISTS "backgroundRotationStartedAt" timestamp DEFAULT now() NOT NULL;
