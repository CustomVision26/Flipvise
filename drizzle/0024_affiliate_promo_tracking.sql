ALTER TABLE "affiliates" ADD COLUMN "promotionalCode" varchar(64);--> statement-breakpoint
ALTER TABLE "affiliates" ADD COLUMN "paidReferralsTotal" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "affiliates" ADD COLUMN "paidReferralsMonth" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "affiliates" ADD COLUMN "paidReferralsMonthKey" varchar(7);--> statement-breakpoint
UPDATE "affiliates" SET "promotionalCode" = 'aff' || "id"::text WHERE "promotionalCode" IS NULL;--> statement-breakpoint
ALTER TABLE "affiliates" ALTER COLUMN "promotionalCode" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "affiliates_promotionalCode_unique" ON "affiliates" ("promotionalCode");
