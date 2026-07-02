import { createClerkClient } from "@clerk/backend";
import {
  getManageableStripeSubscription,
  markStripeSubscriptionStatus,
  setStripeSubscriptionPaymentFailedAt,
} from "@/db/queries/stripe-subscriptions";
import { isWithinPaymentGracePeriod } from "@/lib/billing-grace-period";
import { loopsSendEvent, loopsUpdateContact } from "@/lib/loops";
import { recordBillingNoticeInboxMessage } from "@/lib/record-billing-notice-inbox";
import { asPaidPlanId, setStripeBillingState } from "@/lib/stripe-billing-sync";
import { stripe } from "@/lib/stripe";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

async function clerkUserEmail(userId: string): Promise<string | null> {
  try {
    const user = await clerkClient.users.getUser(userId);
    return (
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress?.toLowerCase() ?? null
    );
  } catch {
    return null;
  }
}

function isStripeSubscriptionAlreadyEnded(status: string): boolean {
  return status === "canceled" || status === "incomplete_expired";
}

/**
 * Returns true when a `past_due` row has exceeded the 12-hour grace window.
 */
export function isPastDueGraceExpired(input: {
  status: string;
  paymentFailedAt: Date | null | undefined;
  nowMs?: number;
}): boolean {
  if (input.status !== "past_due" || !input.paymentFailedAt) return false;
  return !isWithinPaymentGracePeriod(input.paymentFailedAt, input.nowMs);
}

/**
 * Cancels the Stripe subscription and reverts the user to the Free plan after
 * the 12-hour payment grace window ends without a successful renewal.
 */
export async function cancelSubscriptionAfterPaymentGraceExpired(input: {
  userId: string;
  stripeSubscriptionId: string;
  planSlug: string;
}): Promise<boolean> {
  const planSlug = asPaidPlanId(input.planSlug) ?? input.planSlug ?? "pro";

  try {
    const sub = await stripe.subscriptions.retrieve(input.stripeSubscriptionId);
    if (!isStripeSubscriptionAlreadyEnded(sub.status)) {
      await stripe.subscriptions.cancel(input.stripeSubscriptionId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (!message.includes("canceled") && !message.includes("no such subscription")) {
      console.error(
        "[billing-grace] Stripe cancel after grace expired",
        input.stripeSubscriptionId,
        error,
      );
    }
  }

  await markStripeSubscriptionStatus(input.stripeSubscriptionId, "canceled");
  await setStripeSubscriptionPaymentFailedAt(input.stripeSubscriptionId, null);

  await recordBillingNoticeInboxMessage({
    recipientUserId: input.userId,
    noticeKind: "payment_grace_expired",
    stripeSubscriptionId: input.stripeSubscriptionId,
    planSlug,
    eventAt: new Date(),
  });

  await setStripeBillingState(input.userId, null, "canceled");

  void (async () => {
    const email = await clerkUserEmail(input.userId);
    if (!email) return;
    await loopsUpdateContact(email, {
      userId: input.userId,
      userGroup: "free",
    });
    await loopsSendEvent(email, "plan_cancelled", {
      userId: input.userId,
      userGroup: "free",
    });
  })();

  return true;
}

/**
 * When a `past_due` subscription has exceeded the 12-hour grace window, cancel
 * in Stripe and downgrade Clerk billing to Free.
 */
export async function enforceExpiredPaymentGraceIfNeeded(
  userId: string,
): Promise<void> {
  const row = await getManageableStripeSubscription(userId);
  if (!row || !isPastDueGraceExpired(row)) return;

  await cancelSubscriptionAfterPaymentGraceExpired({
    userId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    planSlug: row.planSlug ?? "pro",
  });
}
