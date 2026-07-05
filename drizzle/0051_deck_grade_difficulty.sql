ALTER TABLE "decks" ADD COLUMN IF NOT EXISTS "gradeLevel" varchar(64);
ALTER TABLE "decks" ADD COLUMN IF NOT EXISTS "difficultyLevel" varchar(32);
