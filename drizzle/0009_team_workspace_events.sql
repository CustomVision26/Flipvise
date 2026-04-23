CREATE TYPE "public"."team_workspace_event_action" AS ENUM('created', 'updated', 'deleted');--> statement-breakpoint
CREATE TABLE "team_workspace_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "team_workspace_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"ownerUserId" varchar(255) NOT NULL,
	"action" "team_workspace_event_action" NOT NULL,
	"teamId" integer,
	"teamName" varchar(255) NOT NULL,
	"planSlug" varchar(64) NOT NULL,
	"previousTeamName" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
