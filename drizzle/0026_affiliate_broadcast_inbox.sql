CREATE TABLE "affiliate_broadcast_inbox_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"recipientUserId" varchar(255) NOT NULL,
	"variant" varchar(16) NOT NULL,
	"subject" varchar(200) NOT NULL,
	"messageBody" text NOT NULL,
	"detailsBlock" text NOT NULL,
	"pricingPageUrl" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "affiliate_broadcast_inbox_messages_recipient_idx" ON "affiliate_broadcast_inbox_messages" ("recipientUserId");
