/**
 * Ensures live_classroom_participant_grants exists.
 * Run: npm run db:ensure-live-classroom-participant-grants
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
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

async function exec(statement: string) {
  await sql.query(statement, []);
}

async function main() {
  const migrationPath = resolve(
    process.cwd(),
    "drizzle/0070_live_classroom_participant_grants.sql",
  );
  const raw = readFileSync(migrationPath, "utf8");
  const statements = raw
    .split(/-->\s*statement-breakpoint/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await exec(statement);
  }

  const check = await sql`
    SELECT to_regclass('public.live_classroom_participant_grants') AS grants
  `;
  console.log("Live Classroom participant grants ready:", check[0]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
