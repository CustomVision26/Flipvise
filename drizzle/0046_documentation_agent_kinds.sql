DO $$ BEGIN
  ALTER TYPE "documentation_content_kind" ADD VALUE 'page_addition';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "documentation_content_kind" ADD VALUE 'page_removal';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "documentation_content_kind" ADD VALUE 'section_addition';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "documentation_content_kind" ADD VALUE 'section_metadata';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
