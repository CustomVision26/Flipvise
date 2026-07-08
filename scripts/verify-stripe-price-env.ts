import { config } from "dotenv";
import { resolve } from "path";
import {
  STRIPE_PAID_PLAN_IDS,
  type StripePaidPlanId,
} from "@/lib/billing-plan-ids";
import {
  readStripePriceIdFromEnv,
  stripePriceEnvPairForPlan,
} from "@/lib/stripe-plan-price-env";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const CORE_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "DATABASE_URL",
  "CLERK_SECRET_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_S3_BUCKET_NAME",
] as const;

function coreStatus(key: string): string {
  const raw = process.env[key]?.trim() ?? "";
  if (!raw) return "MISSING/EMPTY";
  if (key === "NEXT_PUBLIC_APP_URL" && /localhost/i.test(raw)) return "LOCALHOST";
  if (key === "STRIPE_SECRET_KEY") {
    if (raw.startsWith("sk_live_")) return "SET (live)";
    if (raw.startsWith("sk_test_")) return "SET (test)";
    return "SET (unusual format)";
  }
  return "SET";
}

async function verifyPriceInStripe(priceId: string): Promise<string> {
  try {
    const { stripe } = await import("@/lib/stripe");
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active) return "inactive in Stripe";
    const amount = price.unit_amount;
    const currency = price.currency?.toUpperCase() ?? "?";
    const interval = price.recurring?.interval ?? "one-time";
    return `OK (${currency} ${amount != null ? amount / 100 : "?"} / ${interval})`;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/no such price/i.test(msg)) return "NOT FOUND in Stripe";
    return `Stripe error: ${msg.slice(0, 80)}`;
  }
}

async function main() {
  const label = process.argv.includes("--production-check")
    ? "Current process env (e.g. Render shell)"
    : "Local .env.local + .env";

  console.log(`\n=== Stripe / Render env verification (${label}) ===\n`);

  console.log("Core:");
  for (const key of CORE_KEYS) {
    console.log(`  ${key}: ${coreStatus(key)}`);
  }

  const stripeMode = process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_live_")
    ? "live"
    : process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_test_")
      ? "test"
      : "unknown";

  console.log(`\nStripe API mode: ${stripeMode}`);
  console.log("\nEducation + all paid plan price IDs:\n");

  let missing = 0;
  let invalid = 0;

  for (const plan of STRIPE_PAID_PLAN_IDS) {
    for (const period of ["monthly", "yearly"] as const) {
      const pair = stripePriceEnvPairForPlan(plan, period);
      const priceId = readStripePriceIdFromEnv(pair);
      const envKey = pair.primary;

      if (!priceId) {
        missing++;
        console.log(`  ${envKey}: MISSING/EMPTY (${plan} ${period})`);
        continue;
      }

      const stripeCheck = process.env.STRIPE_SECRET_KEY?.trim()
        ? await verifyPriceInStripe(priceId)
        : "skip (no STRIPE_SECRET_KEY)";

      if (stripeCheck.includes("NOT FOUND") || stripeCheck.includes("inactive")) {
        invalid++;
      }

      const isEducation = plan.startsWith("education_");
      const prefix = isEducation ? "★" : " ";
      console.log(
        `${prefix} ${envKey}: ${priceId.slice(0, 12)}… → ${stripeCheck}`,
      );
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Missing price env vars: ${missing}`);
  console.log(`Invalid/inactive Stripe prices: ${invalid}`);
  console.log(
    "\nRender checklist: Service → Environment must include ALL rows above.",
  );
  console.log(
    "Education rows (★) are required for Education plan upgrades/checkout.",
  );

  if (missing > 0 || invalid > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
