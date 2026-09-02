/**
 * Ensures addon_catalog monthlyPrice / yearlyMonthlyPrice columns.
 * Run: npm run db:ensure-addon-catalog-prices
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });
config({ path: resolve(process.cwd(), ".env.db.prod"), override: true });

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL;

if (!databaseUrl) {
  throw new Error(
    "Database URL is not set. Use DATABASE_URL (or POSTGRES_URL / POSTGRES_PRISMA_URL) in .env / .env.local.",
  );
}

const sql = neon(databaseUrl);

async function main() {
  await sql`
    ALTER TABLE "addon_catalog"
    ADD COLUMN IF NOT EXISTS "monthlyPrice" double precision
  `;
  await sql`
    ALTER TABLE "addon_catalog"
    ADD COLUMN IF NOT EXISTS "yearlyMonthlyPrice" double precision
  `;

  const check = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'addon_catalog'
      AND column_name IN ('monthlyPrice', 'yearlyMonthlyPrice')
    ORDER BY column_name
  `;
  console.log("addon_catalog price columns ready:", check);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
