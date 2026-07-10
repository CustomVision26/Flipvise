import { markStripeSubscriptionStatus } from "@/db/queries/stripe-subscriptions";
import { incrementAffiliatePaidReferral } from "@/db/queries/affiliates";
import { stripe } from "@/lib/stripe";
import { persistStripeInvoiceForUser, syncCheckoutSessionInvoicesForUser } from "@/lib/stripe-invoice-persist";
import { recordSubscriptionCheckoutInboxForSession } from "@/lib/record-subscription-checkout-inbox";
import { cancelOtherActiveSubscriptionsForCustomer } from "@/lib/apply-plan-upgrade";
import { asPaidPlanId } from "@/lib/stripe-billing-sync";
import {
  STRIPE_PAID_PLAN_IDS,
  type StripePaidPlanId,
} from "@/lib/billing-plan-ids";
import { loopsSendEvent, loopsUpdateContact } from "@/lib/loops";
import {
  clearPaymentFailedOnInvoiceSuccess,
  handleInvoicePaymentFailed,
  syncCheckoutCompletedSubscription,
  syncSubscriptionLifecycleEvent,
} from "@/lib/stripe-subscription-lifecycle";
import { createClerkClient } from "@clerk/backend";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

const PAID_PLAN_IDS = STRIPE_PAID_PLAN_IDS;
type PaidPlanId = StripePaidPlanId;

function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  }
  return secret;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

async function getClerkUserEmail(userId: string): Promise<string | null> {
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

async function resolvePaidPlanFromCustomer(customerId: string): Promise<PaidPlanId | null> {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return null;
  return asPaidPlanId(customer.metadata?.plan);
}

async function resolveUserAndPlanFromSubscription(sub: Stripe.Subscription): Promise<{
  userId: string;
  plan: PaidPlanId | null;
} | null> {
  const subUserId = stringOrNull(sub.metadata?.clerkUserId);
  const subPlan = asPaidPlanId(sub.metadata?.plan);

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

  let customerUserId: string | null = null;
  let customerPlan: PaidPlanId | null = null;

  if (customerId) {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted) {
      customerUserId = stringOrNull(customer.metadata?.clerkUserId);
      customerPlan = asPaidPlanId(customer.metadata?.plan);
    }
  }

  const userId = subUserId ?? customerUserId;
  if (!userId) return null;

  return { userId, plan: subPlan ?? customerPlan };
}

async function resolveClerkUserIdFromInvoice(invoice: Stripe.Invoice): Promise<string | null> {
  const metadataUserId = stringOrNull(invoice.metadata?.clerkUserId);
  if (metadataUserId) return metadataUserId;

  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return null;

  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return null;
  return stringOrNull(customer.metadata?.clerkUserId);
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, signature, getStripeWebhookSecret());
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.metadata?.checkoutKind === "plan_change") {
          break;
        }

        const userId = stringOrNull(session.metadata?.clerkUserId);
        const selectedPlan = asPaidPlanId(session.metadata?.plan) ?? "pro";
        const isTrialCheckout = session.metadata?.isTrial === "true";

        if (userId) {
          const customerId =
            typeof session.customer === "string" ? session.customer : session.customer?.id;
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id ?? null;

          if (customerId) {
            await stripe.customers.update(customerId, {
              metadata: { clerkUserId: userId, plan: selectedPlan },
            });
          }

          if (customerId && subscriptionId) {
            try {
              await syncCheckoutCompletedSubscription({
                userId,
                selectedPlan,
                subscriptionId,
                customerId,
                isTrialCheckout,
              });
              await cancelOtherActiveSubscriptionsForCustomer(
                customerId,
                subscriptionId,
              );
            } catch (error) {
              console.error(
                "[stripe webhook] checkout.session.completed sync",
                session.id,
                error,
              );
            }
          }

          void (async () => {
            const email = await getClerkUserEmail(userId);
            if (!email) return;
            await loopsUpdateContact(email, { userId, userGroup: selectedPlan });
            if (!isTrialCheckout) {
              await loopsSendEvent(email, "plan_upgraded", {
                userId,
                userGroup: selectedPlan,
              });
            }
          })();
        }

        const affiliateIdRaw = stringOrNull(session.metadata?.affiliateId);
        if (affiliateIdRaw && /^\d+$/.test(affiliateIdRaw)) {
          try {
            await incrementAffiliatePaidReferral(Number(affiliateIdRaw));
          } catch {
            // best-effort
          }
        }

        if (userId && session.id) {
          try {
            await syncCheckoutSessionInvoicesForUser(userId, session.id);
          } catch (error) {
            console.error("[stripe webhook] checkout session invoice sync", session.id, error);
          }
          try {
            await recordSubscriptionCheckoutInboxForSession(userId, session.id);
          } catch (error) {
            console.error("[stripe webhook] subscription inbox", session.id, error);
          }
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        const resolution = await resolveUserAndPlanFromSubscription(sub);
        if (resolution) {
          await syncSubscriptionLifecycleEvent(sub, resolution, event.type);
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const userId = await resolveClerkUserIdFromInvoice(invoice);
        if (userId) {
          await handleInvoicePaymentFailed(invoice, userId);
        }
        break;
      }
      case "invoice.payment_succeeded":
      case "invoice.paid":
      case "invoice.finalized": {
        const invoice = event.data.object as Stripe.Invoice;
        const userId = await resolveClerkUserIdFromInvoice(invoice);
        if (!userId) break;
        const invoicePlan =
          asPaidPlanId(invoice.metadata?.plan) ??
          (typeof invoice.customer === "string"
            ? await resolvePaidPlanFromCustomer(invoice.customer)
            : null) ??
          "pro";

        const user = await clerkClient.users.getUser(userId);
        const userEmail =
          user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress?.toLowerCase() ??
          null;

        if (event.type === "invoice.payment_succeeded") {
          await clearPaymentFailedOnInvoiceSuccess(invoice);
          if (userEmail) {
            void loopsSendEvent(userEmail, "payment_succeeded", {
              userId,
              userGroup: invoicePlan,
            });
          }
        }

        try {
          await persistStripeInvoiceForUser(userId, userEmail, invoice);
        } catch (error) {
          console.error("[stripe webhook] persist invoice", invoice.id, error);
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("stripe webhook failed", error);
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
