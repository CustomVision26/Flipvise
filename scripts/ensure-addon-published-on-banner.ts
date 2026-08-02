/**
 * Ensures addon_catalog.publishedOnBanner exists.
 * Run: npm run db:ensure-addon-published-on-banner
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

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
    ADD COLUMN IF NOT EXISTS "publishedOnBanner" boolean DEFAULT true NOT NULL
  `;

  const check = await sql`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'addon_catalog' AND column_name = 'publishedOnBanner'
  `;
  console.log("addon_catalog.publishedOnBanner ready:", check[0]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
