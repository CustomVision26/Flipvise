-- Store workspace setup details collected at creation (kind, school, class, …)

ALTER TABLE "teams"
  ADD COLUMN IF NOT EXISTS "creationProfile" json;
