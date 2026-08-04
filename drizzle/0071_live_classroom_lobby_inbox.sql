-- Live Classroom™ formal lobby invite messages (in-app inbox)

CREATE TABLE IF NOT EXISTS "live_classroom_lobby_inbox_messages" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "recipientUserId" varchar(255) NOT NULL,
  "teamId" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
  "sessionId" integer NOT NULL REFERENCES "live_classroom_sessions"("id") ON DELETE cascade,
  "title" varchar(200) NOT NULL,
  "description" text NOT NULL,
  "joinCode" varchar(16) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "live_classroom_lobby_inbox_recipient_idx"
  ON "live_classroom_lobby_inbox_messages" USING btree ("recipientUserId");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "live_classroom_lobby_inbox_session_idx"
  ON "live_classroom_lobby_inbox_messages" USING btree ("sessionId");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "live_classroom_lobby_inbox_recipient_session_uidx"
  ON "live_classroom_lobby_inbox_messages" USING btree ("recipientUserId", "sessionId");
