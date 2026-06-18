/**
 * Adds contact_us_replies.imageUrl (drizzle/0042_contact_us_reply_images.sql).
 *
 *   npm run db:ensure-contact-us-reply-images
 */
import { config } from "dotenv";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";
import { resolveDatabaseUrl } from "../src/lib/resolve-database-url";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const sql = neon(resolveDatabaseUrl());

async function main() {
  await sql`ALTER TABLE contact_us_replies ADD COLUMN IF NOT EXISTS "imageUrl" text`;
  console.log("contact_us_replies.imageUrl is ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
