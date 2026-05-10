/**
 * Creates `affiliate_broadcast_inbox_messages` when missing (same DDL as drizzle/0026).
 * Affiliate promo broadcasts are inbox-only (no Loops).
 *
 *   npm run db:ensure-affiliate-broadcast-inbox
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
      AND table_name = 'affiliate_broadcast_inbox_messages'
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
      'Table "affiliate_broadcast_inbox_messages" already exists — nothing to do.',
    );
    return;
  }

  console.log("Creating affiliate_broadcast_inbox_messages …");

  await sql`
    CREATE TABLE "affiliate_broadcast_inbox_messages" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "recipientUserId" varchar(255) NOT NULL,
      "variant" varchar(16) NOT NULL,
      "subject" varchar(200) NOT NULL,
      "messageBody" text NOT NULL,
      "detailsBlock" text NOT NULL,
      "pricingPageUrl" text NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL
    )
  `;

  if (!(await indexExists("affiliate_broadcast_inbox_messages_recipient_idx"))) {
    await sql`
      CREATE INDEX "affiliate_broadcast_inbox_messages_recipient_idx"
      ON "affiliate_broadcast_inbox_messages" ("recipientUserId")
    `;
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
