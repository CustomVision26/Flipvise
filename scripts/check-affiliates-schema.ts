import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  const rows = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'affiliates'
    ORDER BY ordinal_position
  `;
  console.log("Columns in affiliates table:");
  rows.forEach((r) => console.log(` - ${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`));

  const enumRows = await sql`
    SELECT unnest(enum_range(NULL::affiliate_status)) AS value
  `;
  console.log("\naffiliate_status enum values:", enumRows.map((r) => r.value).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
