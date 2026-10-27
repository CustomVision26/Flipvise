CREATE TABLE IF NOT EXISTS "content_deletion_logs" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "ownerUserId" varchar(255) NOT NULL,
  "kind" varchar(16) NOT NULL,
  "deckName" varchar(255) NOT NULL,
  "cardCount" integer,
  "cardLabel" varchar(255),
  "deletedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "content_deletion_logs_owner_idx"
  ON "content_deletion_logs" USING btree ("ownerUserId", "deletedAt");
