ALTER TABLE "teams"
ADD COLUMN IF NOT EXISTS "quizStartScheduleEnabled" boolean NOT NULL DEFAULT false;

ALTER TABLE "teams"
ADD COLUMN IF NOT EXISTS "quizStartAt" timestamp;

ALTER TABLE "decks"
ADD COLUMN IF NOT EXISTS "quizStartScheduleEnabled" boolean NOT NULL DEFAULT false;

ALTER TABLE "decks"
ADD COLUMN IF NOT EXISTS "quizStartAt" timestamp;
