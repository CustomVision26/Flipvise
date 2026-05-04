DO $$ BEGIN
  CREATE TYPE "public"."admin_plan_assignment_action" AS ENUM('plan_assigned', 'plan_removed', 'user_banned', 'user_unbanned');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_plan_assignment_logs" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "targetUserId" varchar(255) NOT NULL,
  "targetUserName" varchar(255) NOT NULL,
  "targetUserEmail" varchar(255),
  "action" "admin_plan_assignment_action" NOT NULL,
  "planName" varchar(128),
  "previousPlanName" varchar(128),
  "assignedByUserId" varchar(255) NOT NULL,
  "assignedByName" varchar(255) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_plan_assignment_logs" ADD COLUMN IF NOT EXISTS "planApplicationPath" varchar(32);
