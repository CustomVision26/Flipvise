DO $$ BEGIN
  CREATE TYPE "public"."contact_us_author_role" AS ENUM('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."contact_us_notification_kind" AS ENUM('new_message', 'admin_reply', 'user_reply');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "contact_us_messages" ADD COLUMN IF NOT EXISTS "accessToken" varchar(64);
ALTER TABLE "contact_us_messages" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp NOT NULL DEFAULT now();

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE "contact_us_messages"
SET "accessToken" = encode(gen_random_bytes(32), 'hex')
WHERE "accessToken" IS NULL;

ALTER TABLE "contact_us_messages" ALTER COLUMN "accessToken" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "contact_us_messages_access_token_uidx"
  ON "contact_us_messages" ("accessToken");

CREATE TABLE IF NOT EXISTS "contact_us_replies" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "messageId" integer NOT NULL REFERENCES "contact_us_messages"("id") ON DELETE CASCADE,
  "authorUserId" varchar(255),
  "authorName" varchar(255) NOT NULL,
  "authorRole" "contact_us_author_role" NOT NULL,
  "message" text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "contact_us_replies_message_idx" ON "contact_us_replies" ("messageId");

ALTER TABLE "contact_us_notifications"
  ADD COLUMN IF NOT EXISTS "kind" "contact_us_notification_kind" NOT NULL DEFAULT 'new_message';
