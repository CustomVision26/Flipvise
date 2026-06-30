/**
 * Adds documentation agent enum values (drizzle/0046_documentation_agent_kinds.sql).
 *
 *   npm run db:ensure-documentation-agent-kinds
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

async function enumHasValue(value: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 AS ok
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'documentation_content_kind'
      AND e.enumlabel = ${value}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function addEnumValue(value: string) {
  if (value === "page_addition") {
    await sql`
      DO $$ BEGIN
        ALTER TYPE "documentation_content_kind" ADD VALUE 'page_addition';
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `;
    return;
  }
  if (value === "page_removal") {
    await sql`
      DO $$ BEGIN
        ALTER TYPE "documentation_content_kind" ADD VALUE 'page_removal';
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `;
    return;
  }
  if (value === "section_addition") {
    await sql`
      DO $$ BEGIN
        ALTER TYPE "documentation_content_kind" ADD VALUE 'section_addition';
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `;
    return;
  }
  if (value === "section_metadata") {
    await sql`
      DO $$ BEGIN
        ALTER TYPE "documentation_content_kind" ADD VALUE 'section_metadata';
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `;
  }
}

async function main() {
  console.log(
    `Using connection from ${resolveDatabaseUrlSource()} (same order as @/db).`,
  );

  for (const kind of [
    "page_addition",
    "page_removal",
    "section_addition",
    "section_metadata",
  ] as const) {
    if (await enumHasValue(kind)) {
      console.log(`documentation_content_kind.${kind} already exists.`);
      continue;
    }
    console.log(`Adding documentation_content_kind value: ${kind}`);
    await addEnumValue(kind);
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
