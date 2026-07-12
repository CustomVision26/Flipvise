/**
 * Creates account_deletion_proration_ledger (if missing).
 * Tracks prorated refunds owed when paid users delete before subscription period end.
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log("Creating account_deletion_proration_ledger table (if missing)...");
  await sql`
    CREATE TABLE IF NOT EXISTS "account_deletion_proration_ledger" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "clerkUserId" varchar(255) NOT NULL,
      "userEmail" varchar(320),
      "userDisplayName" varchar(255),
      "stripeCustomerId" varchar(255) NOT NULL,
      "stripeSubscriptionId" varchar(255) NOT NULL,
      "stripeInvoiceId" varchar(255),
      "planSlug" varchar(64),
      "subscriptionPeriodEnd" timestamp,
      "deletedAt" timestamp NOT NULL DEFAULT now(),
      "estimatedRefundCents" integer NOT NULL DEFAULT 0,
      "refundedCents" integer,
      "currency" varchar(8) NOT NULL DEFAULT 'usd',
      "refundStatus" varchar(32) NOT NULL,
      "stripeRefundId" varchar(255),
      "refundError" text,
      "receiptSentAt" timestamp,
      "receiptSentByAdminUserId" varchar(255),
      "manualRefundByAdminUserId" varchar(255),
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "account_deletion_proration_sub_uidx" UNIQUE("stripeSubscriptionId")
    )
  `;

  console.log("Ensuring indexes...");
  await sql`
    CREATE INDEX IF NOT EXISTS "account_deletion_proration_status_idx"
      ON "account_deletion_proration_ledger" ("refundStatus")
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS "account_deletion_proration_deleted_at_idx"
      ON "account_deletion_proration_ledger" ("deletedAt")
  `;

  console.log("Done. account_deletion_proration_ledger is up to date.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
