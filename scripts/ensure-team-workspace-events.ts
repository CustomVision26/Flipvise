/**
 * Creates `team_workspace_event_action` enum and `team_workspace_events` table if missing.
 * Run if `/dashboard/workspaces` fails with “relation team_workspace_events does not exist”:
 *   npx tsx scripts/ensure-team-workspace-events.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const url =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL;
if (!url) {
  console.error(
    "Database URL is not set. Use DATABASE_URL (or POSTGRES_URL / POSTGRES_PRISMA_URL from Neon/Vercel) in .env / .env.local.",
  );
  process.exit(1);
}

const sql = neon(url);

async function main() {
  const check = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'team_workspace_events'
    ) AS exists
  `;
  const row = check[0] as { exists: boolean };
  if (row.exists) {
    console.log('Table "team_workspace_events" already exists.');
    return;
  }

  await sql`
    DO $$ BEGIN
      CREATE TYPE "public"."team_workspace_event_action" AS ENUM ('created', 'updated', 'deleted');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$
  `;

  await sql`
    CREATE TABLE "team_workspace_events" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (
        SEQUENCE NAME "team_workspace_events_id_seq"
        INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1
      ),
      "ownerUserId" varchar(255) NOT NULL,
      "action" "public"."team_workspace_event_action" NOT NULL,
      "teamId" integer,
      "teamName" varchar(255) NOT NULL,
      "planSlug" varchar(64) NOT NULL,
      "previousTeamName" varchar(255),
      "createdAt" timestamp DEFAULT now() NOT NULL
    )
  `;

  console.log(
    'Created "team_workspace_event_action" enum (if needed) and "team_workspace_events" table.',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
