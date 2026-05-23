import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

async function main() {
  const { stripe } = await import("@/lib/stripe");
  const subId = process.argv[2]?.trim() || "sub_1Ta7yPQcZkyuHW844LkRRUtS";

  const events = await stripe.events.list({ limit: 25, type: "checkout.session.completed" });
  console.log(`Recent checkout.session.completed events (showing up to 25):\n`);
  for (const ev of events.data) {
    const session = ev.data.object as {
      id?: string;
      subscription?: string | { id?: string } | null;
      metadata?: Record<string, string>;
    };
    const sub =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
    const match = sub === subId ? " <-- YOUR SUBSCRIPTION" : "";
    console.log(`${ev.created} | ${ev.id} | session ${session.id} | sub ${sub ?? "—"} | clerk ${session.metadata?.clerkUserId ?? "—"}${match}`);
  }

  console.log("\nWebhook endpoint delivery status:");
  const endpoints = await stripe.webhookEndpoints.list({ limit: 10 });
  for (const ep of endpoints.data) {
    console.log(`- ${ep.url} (${ep.status})`);
  }
}

main().catch(console.error);
