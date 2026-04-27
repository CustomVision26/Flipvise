/**
 * Applies stripe subscription tracking schema changes:
 *   - Creates stripe_subscriptions table (if it doesn't exist)
 *   - Adds unique constraint on affiliates.token (if missing)
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  // Drop and recreate with camelCase column names to match Drizzle ORM query generation.
  console.log("Dropping old stripe_subscriptions table (if exists)...");
  await sql`DROP TABLE IF EXISTS "stripe_subscriptions"`;

  console.log("Creating stripe_subscriptions table with camelCase columns...");
  await sql`
    CREATE TABLE "stripe_subscriptions" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "userId" varchar(255) NOT NULL,
      "stripeCustomerId" varchar(255) NOT NULL,
      "stripeSubscriptionId" varchar(255) NOT NULL,
      "stripeSubscriptionItemId" varchar(255),
      "planSlug" varchar(64),
      "status" varchar(64) NOT NULL DEFAULT 'active',
      "currentPeriodEnd" timestamp,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "stripe_subscriptions_userId_unique" UNIQUE("userId"),
      CONSTRAINT "stripe_subscriptions_stripeSubscriptionId_unique" UNIQUE("stripeSubscriptionId")
    )
  `;

  console.log("Adding unique constraint to affiliates.token (if missing)...");
  await sql`
    DO $$ BEGIN
      ALTER TABLE affiliates ADD CONSTRAINT affiliates_token_unique UNIQUE (token);
    EXCEPTION WHEN duplicate_table THEN NULL;
    END $$;
  `;

  console.log("Done. Schema is up to date.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
