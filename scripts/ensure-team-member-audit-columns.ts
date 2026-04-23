/**
 * Adds `updatedAt` / adder columns on `team_members` if missing (same as drizzle/0010).
 * Run if team admin errors with a failed query listing those columns:
 *   npx tsx scripts/ensure-team-member-audit-columns.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const url =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL;
if (!url) {
  console.error(
    "Database URL is not set. Use DATABASE_URL (or POSTGRES_URL / POSTGRES_PRISMA_URL) in .env / .env.local.",
  );
  process.exit(1);
}

const sql = neon(url);

async function main() {
  await sql`
    ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp
  `;
  await sql`
    UPDATE "team_members" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL
  `;
  await sql`ALTER TABLE "team_members" ALTER COLUMN "updatedAt" SET NOT NULL`;
  await sql`ALTER TABLE "team_members" ALTER COLUMN "updatedAt" SET DEFAULT now()`;
  await sql`ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "addedByUserId" varchar(255)`;
  await sql`ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "addedByAsOwner" boolean`;

  console.log(
    "Ensured team_members audit columns: updatedAt, addedByUserId, addedByAsOwner.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
