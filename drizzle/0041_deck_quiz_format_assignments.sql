-- Admin-assigned quiz question format per card (reshuffled from Team Admin).
ALTER TABLE "decks" ADD COLUMN IF NOT EXISTS "quizFormatAssignments" json;
