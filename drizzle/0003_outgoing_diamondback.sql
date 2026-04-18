CREATE TYPE "public"."card_type" AS ENUM('standard', 'multiple_choice');--> statement-breakpoint
CREATE TYPE "public"."support_category" AS ENUM('general_support', 'bug_report', 'feature_request', 'feedback', 'billing', 'account');--> statement-breakpoint
CREATE TYPE "public"."support_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."support_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TABLE "support_ticket_replies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "support_ticket_replies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"ticketId" integer NOT NULL,
	"adminId" varchar(255) NOT NULL,
	"adminName" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "support_tickets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" varchar(255) NOT NULL,
	"userEmail" varchar(255),
	"userName" varchar(255),
	"subject" varchar(500) NOT NULL,
	"message" text NOT NULL,
	"category" "support_category" NOT NULL,
	"status" "support_status" DEFAULT 'open' NOT NULL,
	"priority" "support_priority" DEFAULT 'normal' NOT NULL,
	"attachmentUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "cardType" "card_type" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "choices" text[];--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "correctChoiceIndex" integer;--> statement-breakpoint
ALTER TABLE "support_ticket_replies" ADD CONSTRAINT "support_ticket_replies_ticketId_support_tickets_id_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;