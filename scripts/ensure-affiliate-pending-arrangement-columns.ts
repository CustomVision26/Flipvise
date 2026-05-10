/**
 * Adds affiliate pending arrangement-change columns when missing (see drizzle/0025_*.sql).
 *
 *   npx tsx scripts/ensure-affiliate-pending-arrangement-columns.ts
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

  // Idempotent per column (matches drizzle/0025). Do not bail after only
  // `pendingPlanAssigned` exists — partial runs used to skip the remaining
  // columns and break `select ... from affiliates`.
  await sql`
    ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "pendingPlanAssigned" varchar(64)
  `;
  await sql`
    ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "pendingEndsAt" timestamp
  `;
  await sql`
    ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "arrangementChangeToken" varchar(64)
  `;
  await sql`
    ALTER TABLE "affiliates" ADD COLUMN IF NOT EXISTS "arrangementChangeExpiresAt" timestamp
  `;

  if (!(await indexExists("affiliates_arrangementChangeToken_unique"))) {
    await sql`
      CREATE UNIQUE INDEX "affiliates_arrangementChangeToken_unique"
      ON "affiliates" ("arrangementChangeToken")
    `;
  }

  console.log(
    "Ensured affiliates pending-arrangement columns + arrangement token index.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
