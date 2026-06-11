/**
 * Adds `team_owner_quiz_defaults.enforce_default_for_all_workspaces` if missing.
 * Run once if quiz timer save errors on unknown column:
 *   npm run db:ensure-owner-quiz-enforce-column
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
    ALTER TABLE "team_owner_quiz_defaults"
    ADD COLUMN IF NOT EXISTS "enforce_default_for_all_workspaces" boolean NOT NULL DEFAULT false
  `;
  console.log(
    'Column "enforce_default_for_all_workspaces" is present on "team_owner_quiz_defaults" (created or already existed).',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
