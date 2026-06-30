DO $$ BEGIN
  CREATE TYPE "documentation_audience" AS ENUM('user', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "documentation_content_kind" AS ENUM('quick_reference_page', 'in_depth_article');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "documentation_overrides" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "audience" "documentation_audience" NOT NULL,
  "contentKind" "documentation_content_kind" NOT NULL,
  "pageId" varchar(128) NOT NULL,
  "payload" json NOT NULL,
  "updatedByUserId" varchar(255) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "documentation_overrides_audience_kind_page_idx"
  ON "documentation_overrides" ("audience", "contentKind", "pageId");
