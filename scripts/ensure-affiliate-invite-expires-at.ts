/**
 * Adds `affiliates.inviteExpiresAt` if missing (same shape as Drizzle / `db:push`).
 * Run if admin or affiliate queries fail with unknown column:
 *   npx tsx scripts/ensure-affiliate-invite-expires-at.ts
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

async function main() {
  console.log(`Using connection from ${resolveDatabaseUrlSource()} (same order as @/db).`);

  await sql`
    ALTER TABLE "affiliates"
    ADD COLUMN IF NOT EXISTS "inviteExpiresAt" timestamp
  `;

  await sql`
    UPDATE "affiliates"
    SET "inviteExpiresAt" = CASE
      WHEN "status" = 'pending' THEN "createdAt" + interval '14 days'
      ELSE COALESCE("inviteAcceptedAt", "createdAt")
    END
    WHERE "inviteExpiresAt" IS NULL
  `;

  await sql`
    ALTER TABLE "affiliates"
    ALTER COLUMN "inviteExpiresAt" SET NOT NULL
  `;

  console.log(
    'Column "inviteExpiresAt" is present on "affiliates" (created or backfilled).',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
