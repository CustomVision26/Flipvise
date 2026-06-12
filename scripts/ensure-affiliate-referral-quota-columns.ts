/**
 * Adds affiliate referral quota columns when missing and removes legacy names.
 * (Canonical DDL: drizzle/0034_affiliate_referral_quota.sql)
 *
 *   npm run db:ensure-affiliate-referral-quota-columns
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

const sql = neon(resolveDatabaseUrl());

async function columnExists(column: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 AS ok
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'affiliates'
      AND column_name = ${column}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function dropLegacyQuotaColumns() {
  const legacyCols = [
    "periodReferralsCount",
    "periodReferralQuota",
    "currentPeriodStartedAt",
    "lastQuotaEvaluationEndsAt",
  ] as const;

  const hasLegacy = await Promise.all(legacyCols.map((c) => columnExists(c)));
  if (!hasLegacy.some(Boolean)) return;

  console.log("Migrating legacy quota column data…");
  if (await columnExists("periodReferralsCount")) {
    await sql`
      UPDATE affiliates
      SET
        "periodPaidReferrals" = COALESCE("periodPaidReferrals", "periodReferralsCount", 0),
        "referralQuotaTarget" = COALESCE("referralQuotaTarget", "periodReferralQuota"),
        "quotaPeriodStartedAt" = COALESCE("quotaPeriodStartedAt", "currentPeriodStartedAt"),
        "referralQuotaEnabled" = CASE
          WHEN "referralQuotaEnabled" = true THEN true
          WHEN "periodReferralQuota" IS NOT NULL AND "periodReferralQuota" > 0 THEN true
          ELSE "referralQuotaEnabled"
        END
      WHERE
        "periodReferralsCount" IS NOT NULL
        OR "periodReferralQuota" IS NOT NULL
        OR "currentPeriodStartedAt" IS NOT NULL
    `;
  }

  for (const col of legacyCols) {
    if (await columnExists(col)) {
      console.log(`Dropping legacy column ${col}…`);
      await sql.unsafe(`ALTER TABLE affiliates DROP COLUMN IF EXISTS "${col}"`);
    }
  }
}

async function main() {
  console.log(
    `Using connection from ${resolveDatabaseUrlSource()} (same order as @/db).`,
  );

  if (!(await columnExists("id"))) {
    console.log('Table "affiliates" not found — run migrations first.');
    return;
  }

  if (!(await columnExists("referralQuotaEnabled"))) {
    console.log("Adding affiliate referral quota columns…");
    await sql`
      ALTER TABLE "affiliates"
      ADD COLUMN "referralQuotaEnabled" boolean DEFAULT false NOT NULL
    `;
    await sql`
      ALTER TABLE "affiliates"
      ADD COLUMN "referralQuotaTarget" integer
    `;
    await sql`
      ALTER TABLE "affiliates"
      ADD COLUMN "periodPaidReferrals" integer DEFAULT 0 NOT NULL
    `;
    await sql`
      ALTER TABLE "affiliates"
      ADD COLUMN "quotaPeriodStartedAt" timestamp
    `;
  } else {
    console.log("Canonical affiliate quota columns present.");
  }

  await dropLegacyQuotaColumns();
  console.log("Affiliate quota schema OK.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
