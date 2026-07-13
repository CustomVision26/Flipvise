-- Personal deck timed-quiz duration (minutes). Null = auto from card count.
ALTER TABLE "decks" ADD COLUMN IF NOT EXISTS "quizDurationMinutes" integer;
