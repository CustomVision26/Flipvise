CREATE TYPE "public"."team_member_history_action" AS ENUM('added', 'removed');--> statement-breakpoint
CREATE TABLE "team_member_history" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "team_member_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"teamId" integer NOT NULL,
	"ownerUserId" varchar(255) NOT NULL,
	"action" "team_member_history_action" NOT NULL,
	"memberUserId" varchar(255) NOT NULL,
	"memberRole" "team_member_role" NOT NULL,
	"actorUserId" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_member_history" ADD CONSTRAINT "team_member_history_teamId_teams_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
