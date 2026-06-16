DO $$ BEGIN
  CREATE TYPE "public"."contact_us_status" AS ENUM('open', 'read', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "platform_contact_settings" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "email" varchar(255) NOT NULL,
  "phone" varchar(64),
  "socialLinks" json NOT NULL DEFAULT '[]',
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "updatedByUserId" varchar(255)
);

CREATE TABLE IF NOT EXISTS "contact_us_messages" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "name" varchar(255) NOT NULL,
  "email" varchar(255) NOT NULL,
  "subject" varchar(500) NOT NULL,
  "message" text NOT NULL,
  "userId" varchar(255),
  "status" "contact_us_status" NOT NULL DEFAULT 'open',
  "readAt" timestamp,
  "readByUserId" varchar(255),
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "contact_us_messages_status_idx" ON "contact_us_messages" ("status");

CREATE TABLE IF NOT EXISTS "contact_us_notifications" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "recipientUserId" varchar(255) NOT NULL,
  "messageId" integer NOT NULL REFERENCES "contact_us_messages"("id") ON DELETE CASCADE,
  "preview" varchar(500) NOT NULL,
  "readAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "contact_us_notifications_recipient_idx" ON "contact_us_notifications" ("recipientUserId");
CREATE INDEX IF NOT EXISTS "contact_us_notifications_message_idx" ON "contact_us_notifications" ("messageId");

INSERT INTO "platform_contact_settings" ("id", "email", "phone", "socialLinks")
VALUES (1, 'customvision26@gmail.com', NULL, '[]')
ON CONFLICT ("id") DO NOTHING;
