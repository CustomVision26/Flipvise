/**
 * Creates `team_member_history_action` enum and `team_member_history` table if missing.
 *
 *   npm run db:ensure-team-member-history
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
        AND table_name = 'team_member_history'
    ) AS exists
  `;
  const row = check[0] as { exists: boolean };
  if (row.exists) {
    console.log('Table "team_member_history" already exists.');
    return;
  }

  await sql`
    DO $$ BEGIN
      CREATE TYPE "public"."team_member_history_action" AS ENUM ('added', 'removed');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$
  `;

  await sql`
    CREATE TABLE "team_member_history" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (
        SEQUENCE NAME "team_member_history_id_seq"
        INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1
      ),
      "teamId" integer NOT NULL,
      "ownerUserId" varchar(255) NOT NULL,
      "action" "public"."team_member_history_action" NOT NULL,
      "memberUserId" varchar(255) NOT NULL,
      "memberRole" "public"."team_member_role" NOT NULL,
      "actorUserId" varchar(255),
      "createdAt" timestamp DEFAULT now() NOT NULL
    )
  `;

  await sql`
    ALTER TABLE "team_member_history"
    ADD CONSTRAINT "team_member_history_teamId_teams_id_fk"
    FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id")
    ON DELETE cascade ON UPDATE no action
  `;

  console.log(
    'Created "team_member_history_action" enum (if needed) and "team_member_history" table.',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
