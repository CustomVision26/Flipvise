-- Quiz question format toggles (workspace defaults + optional per-deck override).
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "quizFormatMultipleChoice" boolean DEFAULT true NOT NULL;
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "quizFormatTrueFalse" boolean DEFAULT false NOT NULL;
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "quizFormatFillInBlank" boolean DEFAULT false NOT NULL;

ALTER TABLE "decks" ADD COLUMN IF NOT EXISTS "quizFormatMultipleChoice" boolean;
ALTER TABLE "decks" ADD COLUMN IF NOT EXISTS "quizFormatTrueFalse" boolean;
ALTER TABLE "decks" ADD COLUMN IF NOT EXISTS "quizFormatFillInBlank" boolean;

-- AI-generated true/false statements and fill-in-the-blank segments per card.
ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "quizVariants" json;
