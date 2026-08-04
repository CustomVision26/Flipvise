-- Live Classroom™ explicit roster assignment (workspace membership alone is not enough)

CREATE TABLE IF NOT EXISTS "live_classroom_participant_grants" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "teamId" integer NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
  "userId" varchar(255) NOT NULL,
  "grantedByUserId" varchar(255) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "live_classroom_participant_grants_team_user_uidx"
  ON "live_classroom_participant_grants" USING btree ("teamId", "userId");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "live_classroom_participant_grants_user_idx"
  ON "live_classroom_participant_grants" USING btree ("userId");
