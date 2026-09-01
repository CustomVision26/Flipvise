/**
 * Adds platform_contact_settings.companyAddress (drizzle/0072_company_address.sql)
 * and seeds Flipvise Studio LLC / Fort Myers mailing address.
 *
 *   npm run db:ensure-company-address
 */
import { config } from "dotenv";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";
import { resolveDatabaseUrl } from "../src/lib/resolve-database-url";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const sql = neon(resolveDatabaseUrl());

const DEFAULT_COMPANY_ADDRESS_JSON =
  '{"name":"Flipvise Studio LLC","streetAddress":"6450 Aragon Way","line2":"apt 205","city":"Fort Myers","stateProvince":"Florida","postalCode":"33966","country":"United States"}';

async function main() {
  await sql`ALTER TABLE platform_contact_settings ADD COLUMN IF NOT EXISTS "companyAddress" json`;
  await sql`
    UPDATE platform_contact_settings
    SET "companyAddress" = ${DEFAULT_COMPANY_ADDRESS_JSON}::json
    WHERE "companyAddress" IS NULL
  `;
  await sql`ALTER TABLE platform_contact_settings ALTER COLUMN "companyAddress" SET NOT NULL`;
  console.log("platform_contact_settings.companyAddress is ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
