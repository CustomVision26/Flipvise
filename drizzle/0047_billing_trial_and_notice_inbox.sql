ALTER TABLE "stripe_subscriptions" ADD COLUMN IF NOT EXISTS "trialEnd" timestamp;
--> statement-breakpoint
ALTER TABLE "stripe_subscriptions" ADD COLUMN IF NOT EXISTS "paymentFailedAt" timestamp;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_plan_trials" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"userId" varchar(255) NOT NULL,
	"planSlug" varchar(64) NOT NULL,
	"stripeSubscriptionId" varchar(255),
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"trialEndsAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_plan_trials_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_notice_inbox_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"recipientUserId" varchar(255) NOT NULL,
	"noticeKind" varchar(32) NOT NULL,
	"stripeSubscriptionId" varchar(255) NOT NULL,
	"planSlug" varchar(64) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"eventAt" timestamp NOT NULL,
	"requiresAction" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_notice_inbox_recipient_idx" ON "billing_notice_inbox_messages" ("recipientUserId");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "billing_notice_inbox_dedupe_uidx" ON "billing_notice_inbox_messages" ("recipientUserId", "noticeKind", "stripeSubscriptionId");
