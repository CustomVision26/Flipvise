/**
 * Renames legacy snake_case `affiliates` columns (from drizzle/0013_marketing_affiliates.sql)
 * to camelCase so they match `src/db/schema.ts` and the rest of the database (decks, cards, etc.).
 *
 * Run when admin or affiliate queries fail with errors that reference missing camelCase columns:
 *   npx tsx scripts/ensure-affiliates-camelcase-columns.ts
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

/** snake_case (0013) → camelCase (current schema) */
const RENAMES: readonly [from: string, to: string][] = [
  ["invited_email", "invitedEmail"],
  ["invited_user_id", "invitedUserId"],
  ["affiliate_name", "affiliateName"],
  ["plan_assigned", "planAssigned"],
  ["started_at", "startedAt"],
  ["ends_at", "endsAt"],
  ["added_by_user_id", "addedByUserId"],
  ["added_by_name", "addedByName"],
  ["revoked_at", "revokedAt"],
  ["revoked_by_user_id", "revokedByUserId"],
  ["revoked_by_name", "revokedByName"],
  ["created_at", "createdAt"],
];

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

async function main() {
  console.log(
    `Using connection from ${resolveDatabaseUrlSource()} (same order as @/db).`,
  );

  const tableOk = await columnExists("id");
  if (!tableOk) {
    console.log('Table "affiliates" not found — run migrations or push schema first.');
    return;
  }

  for (const [from, to] of RENAMES) {
    const hasFrom = await columnExists(from);
    const hasTo = await columnExists(to);
    if (!hasFrom) {
      continue;
    }
    if (hasTo) {
      console.log(
        `Skip ${from} → "${to}": "${to}" already exists (drop or merge ${from} manually if needed).`,
      );
      continue;
    }
    console.log(`Renaming affiliates.${from} → "${to}" ...`);
    await sql.unsafe(`ALTER TABLE affiliates RENAME COLUMN ${from} TO "${to}"`);
  }

  console.log("Done. Affiliates column names should match Drizzle schema.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
