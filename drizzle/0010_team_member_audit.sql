ALTER TABLE "team_members" ADD COLUMN "updatedAt" timestamp;--> statement-breakpoint
UPDATE "team_members" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;--> statement-breakpoint
ALTER TABLE "team_members" ALTER COLUMN "updatedAt" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "team_members" ALTER COLUMN "updatedAt" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "addedByUserId" varchar(255);--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "addedByAsOwner" boolean;--> statement-breakpoint
