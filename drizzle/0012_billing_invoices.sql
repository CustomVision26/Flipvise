CREATE TABLE IF NOT EXISTS "billing_invoices" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "externalId" varchar(255) NOT NULL,
  "source" varchar(32) NOT NULL,
  "userId" varchar(255) NOT NULL,
  "userEmail" varchar(255),
  "planSlug" varchar(128),
  "invoiceNumber" varchar(128),
  "status" varchar(64) DEFAULT 'unknown' NOT NULL,
  "amountCents" integer,
  "currency" varchar(16),
  "hostedInvoiceUrl" text,
  "invoicePdfUrl" text,
  "periodStart" timestamp,
  "periodEnd" timestamp,
  "paidAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "billing_invoices_external_id_uidx"
  ON "billing_invoices" USING btree ("externalId");
