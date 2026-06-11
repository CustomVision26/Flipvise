ALTER TABLE "teams"
ADD COLUMN IF NOT EXISTS "quizSecurityEnabled" boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  CREATE TYPE "quiz_security_session_status" AS ENUM (
    'active',
    'locked',
    'granted_resume',
    'terminated',
    'completed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "quiz_security_sessions" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "userId" varchar(255) NOT NULL,
  "teamId" integer NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "deckId" integer REFERENCES "decks"("id") ON DELETE SET NULL,
  "deckName" varchar(255) NOT NULL,
  "status" "quiz_security_session_status" NOT NULL DEFAULT 'active',
  "sessionState" json,
  "lockedAt" timestamp,
  "terminatedAt" timestamp,
  "completedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "quiz_security_sessions_team_status_idx"
ON "quiz_security_sessions" ("teamId", "status");

CREATE INDEX IF NOT EXISTS "quiz_security_sessions_user_deck_idx"
ON "quiz_security_sessions" ("userId", "deckId");

CREATE TABLE IF NOT EXISTS "quiz_security_inbox_messages" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "recipientUserId" varchar(255) NOT NULL,
  "sessionId" integer NOT NULL REFERENCES "quiz_security_sessions"("id") ON DELETE CASCADE,
  "read" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "quiz_security_inbox_recipient_idx"
ON "quiz_security_inbox_messages" ("recipientUserId");
