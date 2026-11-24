-- About Us draft/published content and audit log.
-- Safe to re-run. Does not update or delete existing rows.

CREATE TABLE IF NOT EXISTS "platform_about_settings" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "draft" json,
  "published" json,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "publishedAt" timestamp,
  "updatedByUserId" varchar(255)
);

CREATE TABLE IF NOT EXISTS "platform_about_audit_logs" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "adminUserId" varchar(255) NOT NULL,
  "action" varchar(64) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "platform_about_audit_logs_created_idx"
  ON "platform_about_audit_logs" ("createdAt");
