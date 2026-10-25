/**
 * Creates illustrated-appearance tables if they are missing.
 * Uses the same env merge as Next.js (`.env` then `.env.local`).
 * Safe to re-run. Does not update or delete existing rows.
 *
 *   npx tsx scripts/ensure-illustrated-appearance.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (.env / .env.local).");
  process.exit(1);
}

const sql = neon(url);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS "user_appearance_preferences" (
      "userId" varchar(255) PRIMARY KEY,
      "illustratedDesignPreferred" boolean DEFAULT false NOT NULL,
      "reduceAnimations" boolean DEFAULT false NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS "platform_appearance_settings" (
      "id" integer PRIMARY KEY DEFAULT 1,
      "illustratedDesignEnabled" boolean DEFAULT false NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL,
      "updatedByUserId" varchar(255)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS "platform_appearance_audit_logs" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "adminUserId" varchar(255) NOT NULL,
      "action" varchar(64) NOT NULL,
      "oldValue" boolean NOT NULL,
      "newValue" boolean NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS "platform_appearance_audit_logs_created_idx"
      ON "platform_appearance_audit_logs" ("createdAt")
  `;
  await sql`
    INSERT INTO "platform_appearance_settings" ("id", "illustratedDesignEnabled")
    VALUES (1, false)
    ON CONFLICT ("id") DO NOTHING
  `;
  console.log("Illustrated appearance tables are present.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
