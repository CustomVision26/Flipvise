CREATE TABLE IF NOT EXISTS "team_owner_quiz_defaults" (
  "ownerUserId" varchar(255) PRIMARY KEY NOT NULL,
  "defaultQuizDurationMinutes" integer DEFAULT 10 NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

INSERT INTO "team_owner_quiz_defaults" ("ownerUserId", "defaultQuizDurationMinutes")
SELECT DISTINCT "ownerUserId", COALESCE("quizDurationMinutes", 10)
FROM "teams"
ON CONFLICT ("ownerUserId") DO NOTHING;

ALTER TABLE "teams" ALTER COLUMN "quizDurationMinutes" DROP DEFAULT;
ALTER TABLE "teams" ALTER COLUMN "quizDurationMinutes" DROP NOT NULL;

UPDATE "teams" SET "quizDurationMinutes" = NULL WHERE "quizDurationMinutes" = 10;
