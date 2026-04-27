ALTER TYPE "public"."affiliate_status" ADD VALUE 'pending';--> statement-breakpoint
ALTER TABLE "affiliates" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "affiliates" ADD COLUMN "token" varchar(64) UNIQUE;--> statement-breakpoint
ALTER TABLE "affiliates" ADD COLUMN "inviteAcceptedAt" timestamp;
