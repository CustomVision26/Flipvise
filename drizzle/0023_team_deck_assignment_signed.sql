ALTER TABLE "team_deck_assignments" ADD COLUMN "assignedByUserId" varchar(255);
--> statement-breakpoint
ALTER TABLE "team_deck_assignments" ADD COLUMN "createdAt" timestamp DEFAULT now() NOT NULL;
