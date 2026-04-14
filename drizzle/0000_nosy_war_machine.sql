-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."admin_privilege_action" AS ENUM('granted', 'revoked');--> statement-breakpoint
CREATE TABLE "admin_privilege_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_privilege_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"targetUserId" varchar(255) NOT NULL,
	"targetUserName" varchar(255) NOT NULL,
	"grantedByUserId" varchar(255) NOT NULL,
	"grantedByName" varchar(255) NOT NULL,
	"action" "admin_privilege_action" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deactivated" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "deactivated_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" varchar(255) NOT NULL,
	"userName" varchar(255) NOT NULL,
	"email" varchar(255),
	"deactivatedByUserId" varchar(255) NOT NULL,
	"deactivatedByName" varchar(255) NOT NULL,
	"reason" text,
	"deactivatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "deactivated_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "decks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cards_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"deckId" integer NOT NULL,
	"front" text,
	"frontImageUrl" text,
	"back" text,
	"backImageUrl" text,
	"aiGenerated" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_deckId_decks_id_fk" FOREIGN KEY ("deckId") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;
*/