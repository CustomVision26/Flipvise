/**
 * Adds billing trial / grace columns and inbox tables when missing (drizzle/0047).
 *
 *   npm run db:ensure-billing-trial-schema
 */
import { config } from "dotenv";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";
import {
  resolveDatabaseUrl,
  resolveDatabaseUrlSource,
} from "../src/lib/resolve-database-url";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const url = resolveDatabaseUrl();
const sql = neon(url);

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 AS ok
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${table}
      AND column_name = ${column}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function tableExists(table: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 AS ok
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ${table}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function indexExists(name: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 AS ok
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = ${name}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function main() {
  console.log(
    `Using connection from ${resolveDatabaseUrlSource()} (same order as @/db).`,
  );

  if (!(await columnExists("stripe_subscriptions", "trialEnd"))) {
    console.log('Adding stripe_subscriptions."trialEnd" …');
    await sql`ALTER TABLE "stripe_subscriptions" ADD COLUMN "trialEnd" timestamp`;
  }

  if (!(await columnExists("stripe_subscriptions", "paymentFailedAt"))) {
    console.log('Adding stripe_subscriptions."paymentFailedAt" …');
    await sql`ALTER TABLE "stripe_subscriptions" ADD COLUMN "paymentFailedAt" timestamp`;
  }

  if (!(await tableExists("user_plan_trials"))) {
    console.log("Creating user_plan_trials …");
    await sql`
      CREATE TABLE "user_plan_trials" (
        "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "userId" varchar(255) NOT NULL,
        "planSlug" varchar(64) NOT NULL,
        "stripeSubscriptionId" varchar(255),
        "startedAt" timestamp DEFAULT now() NOT NULL,
        "trialEndsAt" timestamp NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "user_plan_trials_userId_unique" UNIQUE("userId")
      )
    `;
  }

  if (!(await tableExists("billing_notice_inbox_messages"))) {
    console.log("Creating billing_notice_inbox_messages …");
    await sql`
      CREATE TABLE "billing_notice_inbox_messages" (
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
      )
    `;
  }

  if (!(await indexExists("billing_notice_inbox_recipient_idx"))) {
    await sql`
      CREATE INDEX "billing_notice_inbox_recipient_idx"
      ON "billing_notice_inbox_messages" ("recipientUserId")
    `;
  }

  if (!(await indexExists("billing_notice_inbox_dedupe_uidx"))) {
    await sql`
      CREATE UNIQUE INDEX "billing_notice_inbox_dedupe_uidx"
      ON "billing_notice_inbox_messages" ("recipientUserId", "noticeKind", "stripeSubscriptionId")
    `;
  }

  console.log("Billing trial schema is up to date.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
