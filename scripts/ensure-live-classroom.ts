/**
 * Ensures Live Classroom™ add-on catalog row, AI usage feature enum value, and tables.
 * Prefer `npm run db:migrate:local` when possible; this script is idempotent for deploys.
 * Run: npm run db:ensure-live-classroom
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

async function exec(statement: string) {
  await sql.query(statement, []);
}

async function main() {
  await exec(`
    DO $$ BEGIN
      ALTER TYPE "public"."ai_usage_feature" ADD VALUE IF NOT EXISTS 'live_classroom';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$
  `);

  const enums: Array<[string, string[]]> = [
    [
      "live_classroom_session_status",
      ["scheduled", "lobby", "active", "paused", "completed", "cancelled"],
    ],
    [
      "live_classroom_session_type",
      ["warm_up", "team_battle", "exit_ticket", "review_battle"],
    ],
    [
      "live_classroom_battle_mode",
      ["individual_team", "collaborative_team", "survival"],
    ],
    [
      "live_classroom_team_assignment",
      ["manual", "random", "saved_groups"],
    ],
    ["live_classroom_captain_mode", ["rotation", "random", "fixed"]],
    [
      "live_classroom_strategy_card_kind",
      [
        "double_points",
        "extra_time",
        "fifty_fifty",
        "shield",
        "ai_hint",
        "score_boost",
        "recovery",
      ],
    ],
    [
      "live_classroom_strategy_card_policy",
      ["unlimited", "limited", "disabled"],
    ],
    ["live_classroom_difficulty", ["easy", "medium", "hard"]],
    [
      "live_classroom_org_role",
      ["subscription_owner", "team_administrator", "teacher", "student"],
    ],
  ];

  for (const [name, values] of enums) {
    const list = values.map((v) => `'${v}'`).join(", ");
    await exec(`
      DO $$ BEGIN
        CREATE TYPE "public"."${name}" AS ENUM(${list});
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
  }

  await sql`
    INSERT INTO "addon_catalog" (
      "key",
      "name",
      "description",
      "marketingBlurb",
      "eligiblePlanIds",
      "stripePriceEnvKey",
      "active",
      "publishedOnPricing",
      "publishedOnBanner"
    ) VALUES (
      'live_classroom',
      'Flipvise Live Classroom™',
      'Run real-time interactive learning sessions with warm-up battles, team competitions, exit tickets, strategy cards, and AI session reports. Participant limits inherit your organization licensed seats.',
      'Turn Flipvise into a live teaching platform — Zoom + Kahoot + Flipvise AI for Team and Enterprise organizations.',
      '["pro_plus_team_basic","pro_plus_team_gold","pro_plus_platinum_plan","pro_plus_enterprise","education_gold","education_enterprise"]'::json,
      'STRIPE_ADDON_LIVE_CLASSROOM_PRICE_ID',
      true,
      false,
      true
    )
    ON CONFLICT ("key") DO UPDATE SET
      "name" = EXCLUDED."name",
      "description" = EXCLUDED."description",
      "marketingBlurb" = EXCLUDED."marketingBlurb",
      "eligiblePlanIds" = EXCLUDED."eligiblePlanIds",
      "stripePriceEnvKey" = EXCLUDED."stripePriceEnvKey",
      "publishedOnBanner" = true,
      "updatedAt" = now()
  `;

  // Apply table DDL from migration file via individual IF NOT EXISTS statements
  // that match drizzle/0068_live_classroom.sql (idempotent).
  const { readFileSync } = await import("node:fs");
  const migrationPath = resolve(process.cwd(), "drizzle/0068_live_classroom.sql");
  const raw = readFileSync(migrationPath, "utf8");
  const statements = raw
    .split(/-->\s*statement-breakpoint/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 0 &&
        !s.includes('INSERT INTO "addon_catalog"') &&
        !s.includes('ALTER TYPE "public"."ai_usage_feature"') &&
        !s.includes('CREATE TYPE "public"."live_classroom_'),
    );

  for (const statement of statements) {
    await exec(statement);
  }

  const check = await sql`
    SELECT
      to_regclass('public.live_classroom_sessions') AS sessions,
      to_regclass('public.live_battle_reports') AS reports,
      (SELECT count(*)::int FROM addon_catalog WHERE key = 'live_classroom') AS catalog_seeded
  `;
  console.log("Live Classroom™ ready:", check[0]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
