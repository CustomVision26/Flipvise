/**
 * Adds affiliate promotional code + referral tally columns when missing
 * (same DDL as drizzle/0024_affiliate_promo_tracking.sql).
 *
 *   npx tsx scripts/ensure-affiliate-promo-columns.ts
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

async function columnExists(column: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 AS ok
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'affiliates'
      AND column_name = ${column}
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

  const tableOk = await columnExists("id");
  if (!tableOk) {
    console.log('Table "affiliates" not found — run migrations first.');
    return;
  }

  if (await columnExists("promotionalCode")) {
    console.log(
      "affiliates already has promotionalCode — referral columns assumed present; exiting.",
    );
    return;
  }

  console.log("Adding promotionalCode, paidReferrals*, paidReferralsMonthKey …");

  await sql`ALTER TABLE "affiliates" ADD COLUMN "promotionalCode" varchar(64)`;
  await sql`ALTER TABLE "affiliates" ADD COLUMN "paidReferralsTotal" integer DEFAULT 0 NOT NULL`;
  await sql`ALTER TABLE "affiliates" ADD COLUMN "paidReferralsMonth" integer DEFAULT 0 NOT NULL`;
  await sql`ALTER TABLE "affiliates" ADD COLUMN "paidReferralsMonthKey" varchar(7)`;

  await sql`
    UPDATE "affiliates"
    SET "promotionalCode" = 'aff' || "id"::text
    WHERE "promotionalCode" IS NULL
  `;

  await sql`ALTER TABLE "affiliates" ALTER COLUMN "promotionalCode" SET NOT NULL`;

  if (!(await indexExists("affiliates_promotionalCode_unique"))) {
    await sql`CREATE UNIQUE INDEX "affiliates_promotionalCode_unique" ON "affiliates" ("promotionalCode")`;
  }

  console.log("Done. Reload /admin — affiliate queries should work.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
