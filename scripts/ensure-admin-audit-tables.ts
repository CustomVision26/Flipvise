/**
 * Creates admin audit enums/tables if missing (matches `src/db/schema.ts`).
 * Run when `/admin` fails on `admin_privilege_logs` or `admin_plan_assignment_logs`:
 *   npx tsx scripts/ensure-admin-audit-tables.ts
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
    "Database URL is not set. Use DATABASE_URL (or POSTGRES_URL / POSTGRES_PRISMA_URL) in .env / .env.local.",
  );
  process.exit(1);
}

const sql = neon(url);

async function main() {
  await sql`
    DO $$ BEGIN
      CREATE TYPE "public"."admin_privilege_action" AS ENUM (
        'granted',
        'revoked',
        'superadmin_granted',
        'superadmin_revoked'
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$
  `;

  await sql`
    ALTER TYPE "public"."admin_privilege_action" ADD VALUE IF NOT EXISTS 'granted'
  `;
  await sql`
    ALTER TYPE "public"."admin_privilege_action" ADD VALUE IF NOT EXISTS 'revoked'
  `;
  await sql`
    ALTER TYPE "public"."admin_privilege_action" ADD VALUE IF NOT EXISTS 'superadmin_granted'
  `;
  await sql`
    ALTER TYPE "public"."admin_privilege_action" ADD VALUE IF NOT EXISTS 'superadmin_revoked'
  `;

  const priv = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'admin_privilege_logs'
    ) AS exists
  `;
  if (!(priv[0] as { exists: boolean }).exists) {
    await sql`
      CREATE TABLE "admin_privilege_logs" (
        "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (
          SEQUENCE NAME "admin_privilege_logs_id_seq"
          INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1
        ),
        "targetUserId" varchar(255) NOT NULL,
        "targetUserName" varchar(255) NOT NULL,
        "grantedByUserId" varchar(255) NOT NULL,
        "grantedByName" varchar(255) NOT NULL,
        "action" "public"."admin_privilege_action" NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL
      )
    `;
    console.log('Created table "admin_privilege_logs".');
  } else {
    console.log('Table "admin_privilege_logs" already exists.');
  }

  await sql`
    DO $$ BEGIN
      CREATE TYPE "public"."admin_plan_assignment_action" AS ENUM (
        'plan_assigned',
        'plan_removed',
        'user_banned',
        'user_unbanned'
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$
  `;

  await sql`
    ALTER TYPE "public"."admin_plan_assignment_action" ADD VALUE IF NOT EXISTS 'plan_assigned'
  `;
  await sql`
    ALTER TYPE "public"."admin_plan_assignment_action" ADD VALUE IF NOT EXISTS 'plan_removed'
  `;
  await sql`
    ALTER TYPE "public"."admin_plan_assignment_action" ADD VALUE IF NOT EXISTS 'user_banned'
  `;
  await sql`
    ALTER TYPE "public"."admin_plan_assignment_action" ADD VALUE IF NOT EXISTS 'user_unbanned'
  `;

  const plan = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'admin_plan_assignment_logs'
    ) AS exists
  `;
  if (!(plan[0] as { exists: boolean }).exists) {
    await sql`
      CREATE TABLE "admin_plan_assignment_logs" (
        "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (
          SEQUENCE NAME "admin_plan_assignment_logs_id_seq"
          INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1
        ),
        "targetUserId" varchar(255) NOT NULL,
        "targetUserName" varchar(255) NOT NULL,
        "targetUserEmail" varchar(255),
        "action" "public"."admin_plan_assignment_action" NOT NULL,
        "planName" varchar(128),
        "previousPlanName" varchar(128),
        "assignedByUserId" varchar(255) NOT NULL,
        "assignedByName" varchar(255) NOT NULL,
        "planApplicationPath" varchar(32),
        "createdAt" timestamp DEFAULT now() NOT NULL
      )
    `;
    console.log('Created table "admin_plan_assignment_logs".');
  } else {
    await sql`
      ALTER TABLE "admin_plan_assignment_logs"
      ADD COLUMN IF NOT EXISTS "planApplicationPath" varchar(32)
    `;
    console.log(
      'Table "admin_plan_assignment_logs" already exists (ensured planApplicationPath column).',
    );
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
