ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "inviteExpiresAt" timestamp;--> statement-breakpoint
UPDATE "affiliates"
SET "inviteExpiresAt" = CASE
  WHEN "status" = 'pending' THEN "createdAt" + interval '14 days'
  ELSE COALESCE("inviteAcceptedAt", "createdAt")
END
WHERE "inviteExpiresAt" IS NULL;--> statement-breakpoint
ALTER TABLE "affiliates" ALTER COLUMN "inviteExpiresAt" SET NOT NULL;
