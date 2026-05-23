import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

async function main() {
  const { stripe } = await import("@/lib/stripe");

  const endpoints = await stripe.webhookEndpoints.list({ limit: 20 });
  console.log("\nStripe webhook endpoints:\n");
  for (const ep of endpoints.data) {
    console.log(`- ${ep.url}`);
    console.log(`  status: ${ep.status}`);
    console.log(`  events: ${ep.enabled_events.join(", ")}`);
    console.log("");
  }

  const renderUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://flipvise-sjgw.onrender.com";
  const expected = `${renderUrl.replace(/\/+$/, "")}/api/webhooks/stripe`;
  const match = endpoints.data.find((ep) => ep.url === expected);
  if (match) {
    console.log(`OK: Render webhook endpoint registered (${expected})`);
  } else {
    console.log(`MISSING: No webhook endpoint for ${expected}`);
    console.log("Add it in Stripe Dashboard → Developers → Webhooks (Test mode).");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
