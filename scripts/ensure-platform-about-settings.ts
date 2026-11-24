/**
 * Creates platform_about_settings and platform_about_audit_logs
 * (drizzle/0082_platform_about_settings.sql).
 *
 *   npm run db:ensure-platform-about-settings
 */
import { config } from "dotenv";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";
import { resolveDatabaseUrl } from "../src/lib/resolve-database-url";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const sql = neon(resolveDatabaseUrl());

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS "platform_about_settings" (
      "id" integer PRIMARY KEY DEFAULT 1,
      "draft" json,
      "published" json,
      "updatedAt" timestamp DEFAULT now() NOT NULL,
      "publishedAt" timestamp,
      "updatedByUserId" varchar(255)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS "platform_about_audit_logs" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "adminUserId" varchar(255) NOT NULL,
      "action" varchar(64) NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS "platform_about_audit_logs_created_idx"
      ON "platform_about_audit_logs" ("createdAt")
  `;
  console.log("platform_about_settings is ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
