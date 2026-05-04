CREATE TYPE "public"."admin_plan_assignment_invite_status" AS ENUM('pending', 'accepted', 'declined', 'superseded');
--> statement-breakpoint
CREATE TABLE "admin_plan_assignment_invites" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "targetUserId" varchar(255) NOT NULL,
  "assignedByUserId" varchar(255) NOT NULL,
  "assignedByName" varchar(255) NOT NULL,
  "targetUserName" varchar(255) NOT NULL,
  "assignment" varchar(64) NOT NULL,
  "previousPlanSlug" varchar(64),
  "status" "admin_plan_assignment_invite_status" DEFAULT 'pending' NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "respondedAt" timestamp
);
