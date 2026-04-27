CREATE TYPE "public"."affiliate_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TABLE "affiliates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "affiliates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"invited_email" varchar(255) NOT NULL,
	"invited_user_id" varchar(255),
	"affiliate_name" varchar(255) NOT NULL,
	"plan_assigned" varchar(64) NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ends_at" timestamp NOT NULL,
	"added_by_user_id" varchar(255) NOT NULL,
	"added_by_name" varchar(255) NOT NULL,
	"status" "affiliate_status" DEFAULT 'active' NOT NULL,
	"revoked_at" timestamp,
	"revoked_by_user_id" varchar(255),
	"revoked_by_name" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
