import type Stripe from "stripe";
import {
  getStripeSubscriptionBySubscriptionId,
  markStripeSubscriptionStatus,
} from "@/db/queries/stripe-subscriptions";
import { recordUserPlanTrial } from "@/db/queries/user-plan-trials";
import type { StripePaidPlanId } from "@/lib/billing-plan-ids";
import {
  resolveClerkBillingStatusFromStripe,
  stripeSubscriptionTrialEnd,
} from "@/lib/billing-stripe-status";
import { paymentGraceExpiresAt } from "@/lib/billing-grace-period";
import {
  cancelSubscriptionAfterPaymentGraceExpired,
  isPastDueGraceExpired,
} from "@/lib/billing-grace-enforcement";
import { recordBillingNoticeInboxMessage } from "@/lib/record-billing-notice-inbox";
import {
  asPaidPlanId,
  setStripeBillingState,
  upsertStripeSubscriptionFromStripeSub,
} from "@/lib/stripe-billing-sync";
import { loopsSendEvent, loopsUpdateContact } from "@/lib/loops";
import { stripe } from "@/lib/stripe";
import { createClerkClient } from "@clerk/backend";

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

function paidPlanFromSubscription(
  sub: Stripe.Subscription,
  fallback: StripePaidPlanId | null,
): StripePaidPlanId | null {
  return asPaidPlanId(sub.metadata?.plan) ?? fallback;
}

function isPaidAccessBillingStatus(status: string): boolean {
  return status === "active" || status === "trialing";
}

export async function syncCheckoutCompletedSubscription(input: {
  userId: string;
  selectedPlan: StripePaidPlanId;
  subscriptionId: string;
  customerId: string;
  isTrialCheckout: boolean;
}): Promise<void> {
  const sub = await stripe.subscriptions.retrieve(input.subscriptionId, {
    expand: ["items.data"],
  });

  const billingStatus = resolveClerkBillingStatusFromStripe({
    stripeStatus: sub.status,
    paymentFailedAt: null,
  });

  await setStripeBillingState(input.userId, input.selectedPlan, billingStatus);
  await upsertStripeSubscriptionFromStripeSub(
    input.userId,
    sub,
    input.selectedPlan,
    { paymentFailedAt: null },
  );

  if (sub.status === "trialing" || input.isTrialCheckout) {
    const trialEnd = stripeSubscriptionTrialEnd(sub);
    if (trialEnd) {
      await recordUserPlanTrial({
        userId: input.userId,
        planSlug: input.selectedPlan,
        stripeSubscriptionId: sub.id,
        trialEndsAt: trialEnd,
      });
    }
  }
}

export async function syncSubscriptionLifecycleEvent(
  sub: Stripe.Subscription,
  resolution: { userId: string; plan: StripePaidPlanId | null },
  eventType: string,
): Promise<void> {
  const existingRow = await getStripeSubscriptionBySubscriptionId(sub.id);
  const previousStatus = existingRow?.status ?? null;
  const stripeStatus = sub.status;
  const plan =
    paidPlanFromSubscription(sub, resolution.plan) ?? resolution.plan ?? "pro";

  let paymentFailedAt = existingRow?.paymentFailedAt ?? null;

  if (stripeStatus === "past_due") {
    if (isPastDueGraceExpired({ status: stripeStatus, paymentFailedAt })) {
      await cancelSubscriptionAfterPaymentGraceExpired({
        userId: resolution.userId,
        stripeSubscriptionId: sub.id,
        planSlug: plan,
      });
      return;
    }
    if (!paymentFailedAt) {
      paymentFailedAt = new Date();
      await recordBillingNoticeInboxMessage({
        recipientUserId: resolution.userId,
        noticeKind: "payment_grace",
        stripeSubscriptionId: sub.id,
        planSlug: plan,
        eventAt: paymentGraceExpiresAt(paymentFailedAt),
      });
    }
  } else if (stripeStatus === "active" || stripeStatus === "trialing") {
    paymentFailedAt = null;
  }

  const billingStatus = resolveClerkBillingStatusFromStripe({
    stripeStatus,
    paymentFailedAt,
  });

  const retainsAccess = isPaidAccessBillingStatus(billingStatus);
  const activePlan = retainsAccess ? plan : null;

  await setStripeBillingState(resolution.userId, activePlan, billingStatus);

  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

  if (customerId && activePlan && retainsAccess) {
    try {
      await stripe.customers.update(customerId, {
        metadata: {
          clerkUserId: resolution.userId,
          plan: activePlan,
        },
      });
    } catch {
      // Best-effort
    }
  }

  if (
    previousStatus === "trialing" &&
    !retainsAccess &&
    (stripeStatus === "canceled" ||
      stripeStatus === "unpaid" ||
      stripeStatus === "incomplete_expired")
  ) {
    const trialEnd = stripeSubscriptionTrialEnd(sub) ?? new Date();
    await recordBillingNoticeInboxMessage({
      recipientUserId: resolution.userId,
      noticeKind: "trial_expired",
      stripeSubscriptionId: sub.id,
      planSlug: plan,
      eventAt: trialEnd,
    });
  }

  try {
    if (customerId) {
      if (stripeStatus === "canceled" || stripeStatus === "incomplete_expired") {
        await markStripeSubscriptionStatus(sub.id, stripeStatus);
      } else {
        await upsertStripeSubscriptionFromStripeSub(
          resolution.userId,
          sub,
          activePlan,
          { paymentFailedAt },
        );
      }
    }
  } catch {
    // Best-effort
  }

  void (async () => {
    const email = await clerkUserEmail(resolution.userId);
    if (!email) return;
    if (retainsAccess) {
      await loopsUpdateContact(email, {
        userId: resolution.userId,
        userGroup: activePlan ?? "pro",
      });
    } else {
      await loopsUpdateContact(email, {
        userId: resolution.userId,
        userGroup: "free",
      });
      await loopsSendEvent(email, "plan_cancelled", {
        userId: resolution.userId,
        userGroup: "free",
      });
    }
  })();

  if (eventType === "customer.subscription.trial_will_end") {
    const trialEnd = stripeSubscriptionTrialEnd(sub);
    if (trialEnd) {
      await recordBillingNoticeInboxMessage({
        recipientUserId: resolution.userId,
        noticeKind: "trial_ending",
        stripeSubscriptionId: sub.id,
        planSlug: plan,
        eventAt: trialEnd,
      });
    }
  }
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const raw = invoice as unknown as Record<string, unknown>;
  const subscriptionRef = raw.subscription;
  if (typeof subscriptionRef === "string") return subscriptionRef;
  if (
    typeof subscriptionRef === "object" &&
    subscriptionRef !== null &&
    typeof (subscriptionRef as { id?: string }).id === "string"
  ) {
    return (subscriptionRef as { id: string }).id;
  }
  return null;
}

export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  userId: string,
): Promise<void> {
  const subscriptionId = subscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;

  const existingRow = await getStripeSubscriptionBySubscriptionId(subscriptionId);
  if (!existingRow) return;

  const failedAt = existingRow.paymentFailedAt ?? new Date();
  const plan = asPaidPlanId(existingRow.planSlug) ?? "pro";
  const sub = await stripe.subscriptions.retrieve(subscriptionId);

  if (isPastDueGraceExpired({ status: sub.status, paymentFailedAt: failedAt })) {
    await cancelSubscriptionAfterPaymentGraceExpired({
      userId,
      stripeSubscriptionId: subscriptionId,
      planSlug: plan,
    });
    return;
  }

  if (!existingRow.paymentFailedAt) {
    await upsertStripeSubscriptionFromStripeSub(userId, sub, plan, {
      paymentFailedAt: failedAt,
    });

    await recordBillingNoticeInboxMessage({
      recipientUserId: userId,
      noticeKind: "payment_grace",
      stripeSubscriptionId: subscriptionId,
      planSlug: plan,
      eventAt: paymentGraceExpiresAt(failedAt),
    });
  }

  const billingStatus = resolveClerkBillingStatusFromStripe({
    stripeStatus: sub.status,
    paymentFailedAt: failedAt,
  });
  await setStripeBillingState(userId, plan, billingStatus);
}

export async function clearPaymentFailedOnInvoiceSuccess(
  invoice: Stripe.Invoice,
): Promise<void> {
  const subscriptionId = subscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;

  const existingRow = await getStripeSubscriptionBySubscriptionId(subscriptionId);
  if (!existingRow?.paymentFailedAt) return;

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const plan = asPaidPlanId(existingRow.planSlug) ?? "pro";
  await upsertStripeSubscriptionFromStripeSub(existingRow.userId, sub, plan, {
    paymentFailedAt: null,
  });
}
