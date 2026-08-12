/**
 * Adds `head_to_head` to the `live_classroom_session_type` Postgres enum —
 * the new "every player for themselves" session type that only allows the
 * Survival battle mode. Idempotent (Postgres 12+ supports `ADD VALUE IF NOT
 * EXISTS`). Legacy values (`exit_ticket`, `review_battle`) are left in place
 * so historical sessions keep loading.
 *
 * Run once:
 *   npx tsx scripts/ensure-live-classroom-head-to-head-session-type.ts
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
    ALTER TYPE "live_classroom_session_type" ADD VALUE IF NOT EXISTS 'head_to_head'
  `;
  console.log(
    'Enum value "head_to_head" is present on "live_classroom_session_type" (created or already existed).',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
