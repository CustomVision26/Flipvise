/**
 * Applies support ticket messaging DDL (drizzle/0035_support_ticket_messaging.sql).
 *
 *   npm run db:ensure-support-ticket-messaging
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

async function main() {
  console.log(
    `Using connection from ${resolveDatabaseUrlSource()} (same order as @/db).`,
  );

  await sql`DO $$ BEGIN
    CREATE TYPE "public"."support_author_role" AS ENUM('admin', 'user');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$`;

  await sql`DO $$ BEGIN
    CREATE TYPE "public"."support_notification_kind" AS ENUM('new_ticket', 'admin_reply', 'user_reply', 'status_resolved');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$`;

  await sql`ALTER TABLE "support_ticket_replies" ADD COLUMN IF NOT EXISTS "authorUserId" varchar(255)`;
  await sql`ALTER TABLE "support_ticket_replies" ADD COLUMN IF NOT EXISTS "authorName" varchar(255)`;
  await sql`ALTER TABLE "support_ticket_replies" ADD COLUMN IF NOT EXISTS "authorRole" "support_author_role"`;

  await sql`UPDATE "support_ticket_replies"
    SET "authorUserId" = "adminId"
    WHERE "authorUserId" IS NULL AND "adminId" IS NOT NULL`;

  await sql`UPDATE "support_ticket_replies"
    SET "authorName" = COALESCE("adminName", 'Support')
    WHERE "authorName" IS NULL`;

  await sql`UPDATE "support_ticket_replies"
    SET "authorRole" = 'admin'
    WHERE "authorRole" IS NULL`;

  await sql`ALTER TABLE "support_ticket_replies" ALTER COLUMN "authorRole" SET DEFAULT 'admin'`;
  await sql`ALTER TABLE "support_ticket_replies" ALTER COLUMN "authorRole" SET NOT NULL`;

  await sql`ALTER TABLE "support_ticket_replies" ALTER COLUMN "adminId" DROP NOT NULL`;
  await sql`ALTER TABLE "support_ticket_replies" ALTER COLUMN "adminName" DROP NOT NULL`;

  await sql`CREATE TABLE IF NOT EXISTS "support_ticket_notifications" (
    "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    "recipientUserId" varchar(255) NOT NULL,
    "ticketId" integer NOT NULL REFERENCES "support_tickets"("id") ON DELETE CASCADE,
    "kind" "support_notification_kind" NOT NULL,
    "preview" varchar(500) NOT NULL,
    "readAt" timestamp,
    "createdAt" timestamp DEFAULT now() NOT NULL
  )`;

  await sql`CREATE INDEX IF NOT EXISTS "support_ticket_notifications_recipient_idx"
    ON "support_ticket_notifications" ("recipientUserId")`;

  await sql`CREATE INDEX IF NOT EXISTS "support_ticket_notifications_ticket_idx"
    ON "support_ticket_notifications" ("ticketId")`;

  console.log("Support ticket messaging schema is up to date.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
