ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "quizDurationMinutes" integer DEFAULT 10 NOT NULL;
