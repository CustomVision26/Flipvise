-- Per-viewer quiz card order (Team Admin / owner shuffle for unique member sequences).
ALTER TABLE "decks" ADD COLUMN IF NOT EXISTS "quizCardOrderShuffledAt" timestamp;

CREATE TABLE IF NOT EXISTS "quiz_card_orders" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "teamId" integer NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "deckId" integer NOT NULL REFERENCES "decks"("id") ON DELETE CASCADE,
  "viewerUserId" varchar(255) NOT NULL,
  "cardIds" json NOT NULL,
  "shuffledAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "quiz_card_orders_team_deck_viewer_uidx"
  ON "quiz_card_orders" ("teamId", "deckId", "viewerUserId");
