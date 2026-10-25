-- Illustrated deck appearance: user preference, global master switch, and audit log.
-- Safe to re-run. Does not update or delete existing rows.

CREATE TABLE IF NOT EXISTS "user_appearance_preferences" (
  "userId" varchar(255) PRIMARY KEY,
  "illustratedDesignPreferred" boolean DEFAULT false NOT NULL,
  "reduceAnimations" boolean DEFAULT false NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "platform_appearance_settings" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "illustratedDesignEnabled" boolean DEFAULT false NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "updatedByUserId" varchar(255)
);

CREATE TABLE IF NOT EXISTS "platform_appearance_audit_logs" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "adminUserId" varchar(255) NOT NULL,
  "action" varchar(64) NOT NULL,
  "oldValue" boolean NOT NULL,
  "newValue" boolean NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "platform_appearance_audit_logs_created_idx"
  ON "platform_appearance_audit_logs" ("createdAt");

INSERT INTO "platform_appearance_settings" ("id", "illustratedDesignEnabled")
VALUES (1, false)
ON CONFLICT ("id") DO NOTHING;
