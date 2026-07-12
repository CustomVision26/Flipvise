/**
 * Creates `welcome_inbox_messages` when missing.
 *
 *   npm run db:ensure-welcome-inbox
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

async function tableExists(): Promise<boolean> {
  const rows = await sql`
    SELECT 1 AS ok
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'welcome_inbox_messages'
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
    console.log('Table "welcome_inbox_messages" already exists — nothing to do.');
    return;
  }

  console.log("Creating welcome_inbox_messages …");

  await sql`
    CREATE TABLE "welcome_inbox_messages" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "recipientUserId" varchar(255) NOT NULL,
      "title" varchar(200) NOT NULL,
      "description" text NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL
    )
  `;

  if (!(await indexExists("welcome_inbox_recipient_uidx"))) {
    await sql`
      CREATE UNIQUE INDEX "welcome_inbox_recipient_uidx"
      ON "welcome_inbox_messages" ("recipientUserId")
    `;
  }

  if (!(await indexExists("welcome_inbox_recipient_idx"))) {
    await sql`
      CREATE INDEX "welcome_inbox_recipient_idx"
      ON "welcome_inbox_messages" ("recipientUserId")
    `;
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
