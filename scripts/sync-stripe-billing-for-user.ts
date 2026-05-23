/**
 * One-off: sync Clerk billing metadata from Stripe for a Clerk user id.
 * Usage: npx tsx scripts/sync-stripe-billing-for-user.ts user_xxx
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

async function main() {
  const { createClerkClient } = await import("@clerk/backend");
  const { syncActiveSubscriptionFromStripeForUser } = await import(
    "@/lib/stripe-billing-sync"
  );

  const userId = process.argv[2]?.trim();
  if (!userId) {
    console.error("Usage: npx tsx scripts/sync-stripe-billing-for-user.ts <clerkUserId>");
    process.exit(1);
  }

  console.log(`Syncing Stripe subscription for ${userId}...`);
  const result = await syncActiveSubscriptionFromStripeForUser(userId);
  console.log("Sync result:", result);

  if (!result.synced) {
    console.error("No active Stripe subscription found for this user.");
    process.exit(1);
  }

  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  const user = await clerk.users.getUser(userId);
  const meta = user.publicMetadata as Record<string, unknown>;
  console.log("Clerk publicMetadata after sync:", {
    plan: meta.plan,
    billingPlan: meta.billingPlan,
    billingStatus: meta.billingStatus,
    billingPlanUpdatedAt: meta.billingPlanUpdatedAt,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
