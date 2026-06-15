/**
 * Creates `subscription_checkout_confirmations` when missing (same DDL as drizzle/0037).
 *
 *   npm run db:ensure-subscription-checkout-inbox
 *
 * Env: `.env` then `.env.local` (override), same as Next.js.
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

async function tableExists(): Promise<boolean> {
  const rows = await sql`
    SELECT 1 AS ok
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'subscription_checkout_confirmations'
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

  if (await tableExists()) {
    console.log(
      'Table "subscription_checkout_confirmations" already exists — nothing to do.',
    );
    return;
  }

  console.log("Creating subscription_checkout_confirmations …");

  await sql`
    CREATE TABLE "subscription_checkout_confirmations" (
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
    )
  `;

  if (!(await indexExists("subscription_checkout_confirmations_session_uidx"))) {
    await sql`
      CREATE UNIQUE INDEX "subscription_checkout_confirmations_session_uidx"
      ON "subscription_checkout_confirmations" ("checkoutSessionId")
    `;
  }

  if (!(await indexExists("subscription_checkout_confirmations_user_idx"))) {
    await sql`
      CREATE INDEX "subscription_checkout_confirmations_user_idx"
      ON "subscription_checkout_confirmations" ("userId")
    `;
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
