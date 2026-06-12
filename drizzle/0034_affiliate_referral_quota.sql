ALTER TABLE "affiliates" ADD COLUMN "referralQuotaEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "affiliates" ADD COLUMN "referralQuotaTarget" integer;--> statement-breakpoint
ALTER TABLE "affiliates" ADD COLUMN "periodPaidReferrals" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "affiliates" ADD COLUMN "quotaPeriodStartedAt" timestamp;
