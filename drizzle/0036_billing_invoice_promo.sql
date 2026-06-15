ALTER TABLE "billing_invoices" ADD COLUMN IF NOT EXISTS "promoCode" varchar(128);
--> statement-breakpoint
ALTER TABLE "billing_invoices" ADD COLUMN IF NOT EXISTS "promoKind" varchar(16);
