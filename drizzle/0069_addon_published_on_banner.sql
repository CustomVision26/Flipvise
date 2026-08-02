-- Per-add-on flag: show/hide in the top-header add-ons banner

ALTER TABLE "addon_catalog"
  ADD COLUMN IF NOT EXISTS "publishedOnBanner" boolean DEFAULT true NOT NULL;
