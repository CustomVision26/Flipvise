/**
 * Adds `revoked` to `team_invitation_status` if missing (required for admin “Revoke” on pending invites).
 * Run once if you see enum errors on revoke:
 *   npx tsx scripts/ensure-team-invitation-revoked-enum.ts
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
  const rows = await sql`
    SELECT e.enumlabel AS label
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'team_invitation_status'
  `;
  const labels = new Set(
    (rows as { label: string }[]).map((r) => r.label),
  );
  if (labels.has("revoked")) {
    console.log('Enum "team_invitation_status" already includes revoked.');
    return;
  }
  await sql`ALTER TYPE "public"."team_invitation_status" ADD VALUE 'revoked'`;
  console.log('Added enum value revoked to "team_invitation_status".');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
