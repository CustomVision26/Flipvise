/**
 * Adds support_ticket_replies.imageUrl.
 * Run if support chat image attachments fail:
 *   npm run db:ensure-support-ticket-reply-images
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
    "Database URL is not set. Use DATABASE_URL in .env / .env.local (or .env.db.prod for production).",
  );
  process.exit(1);
}

const sql = neon(url);

async function main() {
  await sql`ALTER TABLE support_ticket_replies ADD COLUMN IF NOT EXISTS "imageUrl" text`;
  console.log("support_ticket_replies.imageUrl is ready.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
