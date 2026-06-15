CREATE TABLE IF NOT EXISTS "subscription_checkout_confirmations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"userId" varchar(255) NOT NULL,
	"checkoutSessionId" varchar(255) NOT NULL,
	"planSlug" varchar(128) NOT NULL,
	"planLabel" varchar(128) NOT NULL,
	"period" varchar(16) NOT NULL,
	"amountCents" integer,
	"currency" varchar(16),
	"promoDisplay" varchar(255),
	"receiptUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_checkout_confirmations_session_uidx" ON "subscription_checkout_confirmations" ("checkoutSessionId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_checkout_confirmations_user_idx" ON "subscription_checkout_confirmations" ("userId");
