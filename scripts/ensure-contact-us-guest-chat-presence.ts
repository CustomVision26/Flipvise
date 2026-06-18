/**
 * Adds contact_us_messages.guestChatLastSeenAt (drizzle/0043_contact_us_guest_chat_presence.sql).
 *
 *   npm run db:ensure-contact-us-guest-chat-presence
 */
import { config } from "dotenv";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";
import { resolveDatabaseUrl } from "../src/lib/resolve-database-url";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const sql = neon(resolveDatabaseUrl());

async function main() {
  await sql`ALTER TABLE contact_us_messages ADD COLUMN IF NOT EXISTS "guestChatLastSeenAt" timestamp`;
  console.log("contact_us_messages.guestChatLastSeenAt is ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
