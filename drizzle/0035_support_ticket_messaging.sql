DO $$ BEGIN
  CREATE TYPE "public"."support_author_role" AS ENUM('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."support_notification_kind" AS ENUM('new_ticket', 'admin_reply', 'user_reply', 'status_resolved');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "support_ticket_replies" ADD COLUMN IF NOT EXISTS "authorUserId" varchar(255);
ALTER TABLE "support_ticket_replies" ADD COLUMN IF NOT EXISTS "authorName" varchar(255);
ALTER TABLE "support_ticket_replies" ADD COLUMN IF NOT EXISTS "authorRole" "support_author_role";

UPDATE "support_ticket_replies"
SET "authorUserId" = "adminId"
WHERE "authorUserId" IS NULL AND "adminId" IS NOT NULL;

UPDATE "support_ticket_replies"
SET "authorName" = COALESCE("adminName", 'Support')
WHERE "authorName" IS NULL;

UPDATE "support_ticket_replies"
SET "authorRole" = 'admin'
WHERE "authorRole" IS NULL;

ALTER TABLE "support_ticket_replies" ALTER COLUMN "authorRole" SET DEFAULT 'admin';
ALTER TABLE "support_ticket_replies" ALTER COLUMN "authorRole" SET NOT NULL;

ALTER TABLE "support_ticket_replies" ALTER COLUMN "adminId" DROP NOT NULL;
ALTER TABLE "support_ticket_replies" ALTER COLUMN "adminName" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "support_ticket_notifications" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "recipientUserId" varchar(255) NOT NULL,
  "ticketId" integer NOT NULL REFERENCES "support_tickets"("id") ON DELETE CASCADE,
  "kind" "support_notification_kind" NOT NULL,
  "preview" varchar(500) NOT NULL,
  "readAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "support_ticket_notifications_recipient_idx"
  ON "support_ticket_notifications" ("recipientUserId");

CREATE INDEX IF NOT EXISTS "support_ticket_notifications_ticket_idx"
  ON "support_ticket_notifications" ("ticketId");
