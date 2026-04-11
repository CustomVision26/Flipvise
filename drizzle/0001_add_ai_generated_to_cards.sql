ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "aiGenerated" boolean DEFAULT false NOT NULL;
