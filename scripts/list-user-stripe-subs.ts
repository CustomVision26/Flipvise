import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local"), override: true });

async function main() {
  const { stripe } = await import("@/lib/stripe");
  const userId = process.argv[2]?.trim() || "user_3E5frFFQnCjMA88LRdcTBKTZHY2";

  const subs = await stripe.subscriptions.search({
    query: `metadata['clerkUserId']:'${userId}'`,
    limit: 20,
  });

  console.log(`Subscriptions for ${userId}:\n`);
  for (const sub of subs.data) {
    console.log(
      `- ${sub.id} | ${sub.status} | plan ${sub.metadata?.plan ?? "—"} | created ${new Date(sub.created * 1000).toISOString()}`,
    );
  }

  const active = subs.data.filter((s) => s.status === "active" || s.status === "trialing");
  if (active.length > 1) {
    console.log(`\nWarning: ${active.length} active subscriptions — consider canceling duplicates in Stripe Dashboard.`);
  }
}

main().catch(console.error);
