CREATE TYPE "public"."team_invitation_status" AS ENUM('pending', 'accepted', 'expired');--> statement-breakpoint
CREATE TYPE "public"."team_member_role" AS ENUM('team_admin', 'team_member');--> statement-breakpoint
CREATE TABLE "team_deck_assignments" (
	"teamId" integer NOT NULL,
	"deckId" integer NOT NULL,
	"memberUserId" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_invitations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "team_invitations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"teamId" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "team_member_role" NOT NULL,
	"token" varchar(64) NOT NULL,
	"status" "team_invitation_status" DEFAULT 'pending' NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "team_members_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"teamId" integer NOT NULL,
	"userId" varchar(255) NOT NULL,
	"role" "team_member_role" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "teams_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"ownerUserId" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"planSlug" varchar(64) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_deck_assignments" ADD CONSTRAINT "team_deck_assignments_teamId_teams_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_deck_assignments" ADD CONSTRAINT "team_deck_assignments_deckId_decks_id_fk" FOREIGN KEY ("deckId") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_teamId_teams_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_teams_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_deck_assign_uidx" ON "team_deck_assignments" USING btree ("teamId","deckId","memberUserId");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_team_user_uidx" ON "team_members" USING btree ("teamId","userId");