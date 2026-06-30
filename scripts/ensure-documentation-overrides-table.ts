/**
 * Creates documentation override enums + table (drizzle/0045_documentation_overrides.sql).
 *
 *   npm run db:ensure-documentation-overrides
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
      AND table_name = 'documentation_overrides'
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
    console.log('Table "documentation_overrides" already exists — skipping table create.');
    return;
  }

  console.log("Creating documentation_overrides …");

  await sql`
    DO $$ BEGIN
      CREATE TYPE "documentation_audience" AS ENUM('user', 'admin');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;

  await sql`
    DO $$ BEGIN
      CREATE TYPE "documentation_content_kind" AS ENUM('quick_reference_page', 'in_depth_article');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `;

  await sql`
    CREATE TABLE "documentation_overrides" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "audience" "documentation_audience" NOT NULL,
      "contentKind" "documentation_content_kind" NOT NULL,
      "pageId" varchar(128) NOT NULL,
      "payload" json NOT NULL,
      "updatedByUserId" varchar(255) NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )
  `;

  if (!(await indexExists("documentation_overrides_audience_kind_page_idx"))) {
    await sql`
      CREATE UNIQUE INDEX "documentation_overrides_audience_kind_page_idx"
      ON "documentation_overrides" ("audience", "contentKind", "pageId")
    `;
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
