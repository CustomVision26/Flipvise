/**
 * Creates add-on catalog / entitlements tables when missing.
 * Prefer this when `drizzle.__drizzle_migrations` is empty (common after db:push / ensure scripts).
 * Run: npm run db:ensure-addon-catalog-entitlements
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL;

if (!databaseUrl) {
  throw new Error(
    "Database URL is not set. Use DATABASE_URL (or POSTGRES_URL / POSTGRES_PRISMA_URL) in .env / .env.local.",
  );
}

const sql = neon(databaseUrl);

async function main() {
  await sql`
    DO $$ BEGIN
      CREATE TYPE "addon_entitlement_source" AS ENUM ('stripe', 'admin');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$
  `;

  await sql`
    DO $$ BEGIN
      CREATE TYPE "addon_entitlement_status" AS ENUM ('active', 'canceled', 'revoked');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "addon_catalog" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "key" varchar(128) NOT NULL,
      "name" varchar(255) NOT NULL,
      "description" text DEFAULT '' NOT NULL,
      "marketingBlurb" text DEFAULT '' NOT NULL,
      "eligiblePlanIds" json DEFAULT '[]'::json NOT NULL,
      "stripePriceEnvKey" varchar(128) DEFAULT '' NOT NULL,
      "active" boolean DEFAULT true NOT NULL,
      "publishedOnPricing" boolean DEFAULT false NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "addon_catalog_settings" (
      "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
      "pricingCatalogVisible" boolean DEFAULT false NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL,
      "updatedByUserId" varchar(255)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "user_addon_entitlements" (
      "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      "userId" varchar(255) NOT NULL,
      "addonKey" varchar(128) NOT NULL,
      "source" "addon_entitlement_source" NOT NULL,
      "status" "addon_entitlement_status" DEFAULT 'active' NOT NULL,
      "stripeSubscriptionId" varchar(255),
      "stripeSubscriptionItemId" varchar(255),
      "grantedByAdminUserId" varchar(255),
      "startsAt" timestamp DEFAULT now() NOT NULL,
      "endsAt" timestamp,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "addon_catalog_key_uidx"
    ON "addon_catalog" ("key")
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "user_addon_entitlements_user_addon_uidx"
    ON "user_addon_entitlements" ("userId", "addonKey")
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "user_addon_entitlements_user_id_idx"
    ON "user_addon_entitlements" ("userId")
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "user_addon_entitlements_addon_key_idx"
    ON "user_addon_entitlements" ("addonKey")
  `;

  await sql`
    INSERT INTO "addon_catalog_settings" ("id", "pricingCatalogVisible")
    VALUES (1, false)
    ON CONFLICT ("id") DO NOTHING
  `;

  await sql`
    INSERT INTO "addon_catalog" (
      "key",
      "name",
      "description",
      "marketingBlurb",
      "eligiblePlanIds",
      "stripePriceEnvKey",
      "active",
      "publishedOnPricing"
    ) VALUES (
      'study_mode_focus',
      'Focus Study Mode',
      'An optional study mode add-on for eligible paid plans.',
      'Unlock Focus Study Mode as a monthly add-on on top of your current plan.',
      '["pro","pro_plus","pro_plus_team_basic","pro_plus_team_gold","pro_plus_platinum_plan","pro_plus_enterprise","education_plus","education_gold","education_enterprise"]'::json,
      'STRIPE_ADDON_STUDY_MODE_FOCUS_PRICE_ID',
      true,
      false
    )
    ON CONFLICT ("key") DO NOTHING
  `;

  const check = await sql`
    SELECT to_regclass('public.addon_catalog') AS addon_catalog,
           to_regclass('public.addon_catalog_settings') AS settings,
           to_regclass('public.user_addon_entitlements') AS entitlements
  `;
  console.log("Add-on catalog entitlements ready:", check[0]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
