CREATE TABLE "stripe_subscriptions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stripe_subscriptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" varchar(255) NOT NULL,
	"stripeCustomerId" varchar(255) NOT NULL,
	"stripeSubscriptionId" varchar(255) NOT NULL,
	"stripeSubscriptionItemId" varchar(255),
	"planSlug" varchar(64),
	"status" varchar(64) DEFAULT 'active' NOT NULL,
	"currentPeriodEnd" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_subscriptions_userId_unique" UNIQUE("userId"),
	CONSTRAINT "stripe_subscriptions_stripeSubscriptionId_unique" UNIQUE("stripeSubscriptionId")
);
