-- Stripe billing_reason + proration line snapshots for plan history / receipts
ALTER TABLE "billing_invoices" ADD COLUMN IF NOT EXISTS "stripeBillingReason" varchar(64);

CREATE TABLE IF NOT EXISTS "billing_proration_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "billing_proration_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" varchar(255) NOT NULL,
	"stripeInvoiceId" varchar(255) NOT NULL,
	"stripeLineId" varchar(255) NOT NULL,
	"amountCents" integer,
	"currency" varchar(16),
	"description" text,
	"periodStart" timestamp,
	"periodEnd" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_proration_lines_stripeLineId_unique" UNIQUE("stripeLineId")
);

CREATE INDEX IF NOT EXISTS "billing_proration_lines_userId_idx" ON "billing_proration_lines" ("userId");
CREATE INDEX IF NOT EXISTS "billing_proration_lines_stripeInvoiceId_idx" ON "billing_proration_lines" ("stripeInvoiceId");
