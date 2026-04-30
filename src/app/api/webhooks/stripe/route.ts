import { createClerkClient } from "@clerk/backend";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { upsertBillingInvoiceRecord } from "@/db/queries/billing";
import {
  upsertStripeSubscription,
  markStripeSubscriptionStatus,
} from "@/db/queries/stripe-subscriptions";
import {
  BILLING_PLAN_KEY,
  BILLING_STATUS_KEY,
  BILLING_PLAN_UPDATED_AT_KEY,
  resolveEffectivePlan,
  type BillingStatusValue,
} from "@/lib/plan-metadata-billing-resolution";
import { stripe } from "@/lib/stripe";
import { isTeamPlanId, TEAM_PLAN_IDS, type TeamPlanId } from "@/lib/team-plans";
import { updateOwnedTeamsPlanSlug } from "@/db/queries/teams";
import { loopsSendEvent, loopsUpdateContact } from "@/lib/loops";

export const dynamic = "force-dynamic";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

const PAID_PLAN_IDS = ["pro", ...TEAM_PLAN_IDS] as const;
type PaidPlanId = "pro" | TeamPlanId;

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

function invoiceAmountCents(invoice: Stripe.Invoice): number | null {
  if (typeof invoice.amount_paid === "number") return invoice.amount_paid;
  if (typeof invoice.amount_due === "number") return invoice.amount_due;
  if (typeof invoice.total === "number") return invoice.total;
  return null;
}

function invoiceSubtotalCents(invoice: Stripe.Invoice): number | null {
  if (typeof invoice.subtotal === "number") return invoice.subtotal;
  return null;
}

/**
 * Sum of all discount amounts on the invoice (in cents).
 * Stripe stores these in `total_discount_amounts[].amount`.
 */
function invoiceDiscountCents(invoice: Stripe.Invoice): number | null {
  const raw = invoice as unknown as Record<string, unknown>;
  if (Array.isArray(raw.total_discount_amounts) && raw.total_discount_amounts.length > 0) {
    const sum = (raw.total_discount_amounts as { amount?: number }[]).reduce(
      (acc, entry) => acc + (entry.amount ?? 0),
      0,
    );
    return sum > 0 ? sum : null;
  }
  return null;
}

/**
 * Human-readable discount label built from the first coupon on the invoice.
 * E.g. "LAUNCH50 — 50% off" or "SAVE10 — $10.00 off".
 */
function invoiceDiscountLabel(invoice: Stripe.Invoice): string | null {
  const raw = invoice as unknown as Record<string, unknown>;
  const discounts = Array.isArray(raw.total_discount_amounts)
    ? (raw.total_discount_amounts as { discount?: Record<string, unknown> }[])
    : [];

  for (const entry of discounts) {
    const coupon = entry.discount?.coupon as Record<string, unknown> | undefined;
    if (!coupon) continue;
    const name = typeof coupon.name === "string" ? coupon.name.trim() : "";
    const id = typeof coupon.id === "string" ? coupon.id.trim() : "";
    const label = name || id;
    if (!label) continue;

    if (coupon.percent_off != null) {
      return `${label} — ${coupon.percent_off}% off`;
    }
    if (typeof coupon.amount_off === "number" && typeof coupon.currency === "string") {
      const formatted = (coupon.amount_off / 100).toFixed(2);
      return `${label} — $${formatted} off`;
    }
    return label;
  }
  return null;
}

function invoiceTaxCents(invoice: Stripe.Invoice): number | null {
  // `tax` and `total_tax_amounts` are present in the Stripe API payload but
  // not exposed in the v22 SDK TypeScript types — cast to access them safely.
  const raw = invoice as unknown as Record<string, unknown>;

  // Prefer the explicit `tax` field.
  if (typeof raw.tax === "number") return raw.tax > 0 ? raw.tax : null;

  // Sum individual tax amounts when `tax` is absent.
  if (Array.isArray(raw.total_tax_amounts) && raw.total_tax_amounts.length > 0) {
    const sum = (raw.total_tax_amounts as { amount?: number }[]).reduce(
      (acc, entry) => acc + (entry.amount ?? 0),
      0,
    );
    return sum > 0 ? sum : null;
  }

  // Last resort: derive tax from total − subtotal (valid when no discounts exist).
  if (typeof invoice.total === "number" && typeof invoice.subtotal === "number") {
    const diff = invoice.total - invoice.subtotal;
    return diff > 0 ? diff : null;
  }

  return null;
}

/**
 * Writes Stripe-sourced billing fields to Clerk public metadata, then recomputes
 * and writes the resolved `plan` value using resolveEffectivePlan().
 *
 * Only this function should write billingPlan / billingStatus / billingPlanUpdatedAt.
 */
async function setStripeBillingState(
  userId: string,
  plan: PaidPlanId | null,
  status: BillingStatusValue,
) {
  const user = await clerkClient.users.getUser(userId);
  const now = new Date().toISOString();
  const existing = user.publicMetadata as Record<string, unknown>;

  const updated: Record<string, unknown> = {
    ...existing,
    [BILLING_PLAN_KEY]: plan,
    [BILLING_STATUS_KEY]: status,
    [BILLING_PLAN_UPDATED_AT_KEY]: now,
  };

  const resolvedPlan = resolveEffectivePlan(updated);
  const isTeamPlan = resolvedPlan !== null && isTeamPlanId(resolvedPlan);

  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...updated,
      plan: resolvedPlan,
      teamPlanId: isTeamPlan ? resolvedPlan : null,
    },
  });

  // Keep all workspaces owned by this user in sync with the new resolved plan
  // so workspace limits (maxTeams / maxMembersPerTeam) always match the active
  // Stripe subscription rather than the plan at workspace creation time.
  try {
    await updateOwnedTeamsPlanSlug(userId, resolvedPlan ?? "pro");
  } catch {
    // Best-effort — billing state already written above; a retry or
    // subsequent plan change will bring the workspace row back in sync.
  }
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

function asPaidPlanId(value: unknown): PaidPlanId | null {
  if (typeof value !== "string") return null;
  return (PAID_PLAN_IDS as readonly string[]).includes(value) ? (value as PaidPlanId) : null;
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
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return null;

  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return null;

  const userId = stringOrNull(customer.metadata?.clerkUserId);
  if (!userId) return null;

  const subPlan = asPaidPlanId(sub.metadata?.plan);
  const customerPlan = asPaidPlanId(customer.metadata?.plan);
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
        const userId = stringOrNull(session.metadata?.clerkUserId);
        const selectedPlan = asPaidPlanId(session.metadata?.plan) ?? "pro";
        if (userId) {
          await setStripeBillingState(userId, selectedPlan, "active");

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

          // Persist the subscription so we can apply proration later.
          if (customerId && subscriptionId) {
            try {
              const sub = await stripe.subscriptions.retrieve(subscriptionId, {
                expand: ["items.data"],
              });
              const firstItem = sub.items?.data?.[0];
              // current_period_end moved to SubscriptionItem in API ≥ 2025-03-31.basil
              const firstItemAny = firstItem as unknown as { current_period_end?: number };
              await upsertStripeSubscription({
                userId,
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscriptionId,
                stripeSubscriptionItemId: firstItem?.id ?? null,
                planSlug: selectedPlan,
                status: sub.status,
                currentPeriodEnd:
                  typeof firstItemAny?.current_period_end === "number"
                    ? new Date(firstItemAny.current_period_end * 1000)
                    : null,
              });
            } catch {
              // Best-effort — billing state already written above.
            }
          }

          // Loops: update contact group + fire plan_upgraded event
          void (async () => {
            const email = await getClerkUserEmail(userId);
            if (!email) return;
            await loopsUpdateContact(email, { userId, userGroup: selectedPlan });
            await loopsSendEvent(email, "plan_upgraded", { userId, userGroup: selectedPlan });
          })();
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const resolution = await resolveUserAndPlanFromSubscription(sub);
        if (resolution) {
          const stripeStatus = sub.status;
          let billingStatus: BillingStatusValue;
          if (stripeStatus === "active") billingStatus = "active";
          else if (stripeStatus === "trialing") billingStatus = "trialing";
          else if (stripeStatus === "canceled") billingStatus = "canceled";
          else billingStatus = "expired";

          const activePlan =
            stripeStatus === "active" || stripeStatus === "trialing"
              ? (resolution.plan ?? "pro")
              : null;

          await setStripeBillingState(resolution.userId, activePlan, billingStatus);

          // Loops: sync userGroup and fire lifecycle events
          void (async () => {
            const email = await getClerkUserEmail(resolution.userId);
            if (!email) return;
            if (billingStatus === "active" || billingStatus === "trialing") {
              await loopsUpdateContact(email, {
                userId: resolution.userId,
                userGroup: activePlan ?? "pro",
              });
            } else {
              // canceled / expired — downgrade contact back to free
              await loopsUpdateContact(email, { userId: resolution.userId, userGroup: "free" });
              await loopsSendEvent(email, "plan_cancelled", {
                userId: resolution.userId,
                userGroup: "free",
              });
            }
          })();

          // Keep the stripe_subscriptions row in sync with the latest status,
          // plan slug, and item ID (price swaps update the item list).
          try {
            const customerId =
              typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
            if (customerId) {
              if (stripeStatus === "canceled" || stripeStatus === "incomplete_expired") {
                await markStripeSubscriptionStatus(sub.id, stripeStatus);
              } else {
                const firstItem = sub.items?.data?.[0];
                // current_period_end moved to SubscriptionItem in API ≥ 2025-03-31.basil
                const firstItemAny = firstItem as unknown as { current_period_end?: number };
                await upsertStripeSubscription({
                  userId: resolution.userId,
                  stripeCustomerId: customerId,
                  stripeSubscriptionId: sub.id,
                  stripeSubscriptionItemId: firstItem?.id ?? null,
                  planSlug: activePlan,
                  status: stripeStatus,
                  currentPeriodEnd:
                    typeof firstItemAny?.current_period_end === "number"
                      ? new Date(firstItemAny.current_period_end * 1000)
                      : null,
                });
              }
            }
          } catch {
            // Best-effort — billing state already written above.
          }
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

        // Loops: fire payment_succeeded once per successful charge
        if (userEmail && event.type === "invoice.payment_succeeded") {
          void loopsSendEvent(userEmail, "payment_succeeded", {
            userId,
            userGroup: invoicePlan,
          });
        }

        // Derive the billing period.
        // Primary: first subscription line item period (most accurate for subscriptions).
        // Fallback: top-level invoice.period_start / period_end fields.
        const raw = invoice as unknown as Record<string, unknown>;
        const firstLine = invoice.lines?.data?.[0];
        const lineStart =
          typeof firstLine?.period?.start === "number" ? firstLine.period.start : null;
        const lineEnd =
          typeof firstLine?.period?.end === "number" ? firstLine.period.end : null;
        const topStart =
          typeof raw.period_start === "number" ? (raw.period_start as number) : null;
        const topEnd =
          typeof raw.period_end === "number" ? (raw.period_end as number) : null;
        const invoicePeriodStart =
          lineStart != null
            ? new Date(lineStart * 1000)
            : topStart != null
              ? new Date(topStart * 1000)
              : null;
        const invoicePeriodEnd =
          lineEnd != null
            ? new Date(lineEnd * 1000)
            : topEnd != null
              ? new Date(topEnd * 1000)
              : null;

        await upsertBillingInvoiceRecord({
          externalId: invoice.id,
          source: "invoice",
          userId,
          userEmail,
          planSlug: invoicePlan,
          invoiceNumber: stringOrNull(invoice.number),
          status: invoice.status ?? "unknown",
          amountCents: invoiceAmountCents(invoice),
          subtotalCents: invoiceSubtotalCents(invoice),
          taxAmountCents: invoiceTaxCents(invoice),
          currency: stringOrNull(invoice.currency),
          hostedInvoiceUrl: stringOrNull(invoice.hosted_invoice_url),
          invoicePdfUrl: stringOrNull(invoice.invoice_pdf),
          periodStart: invoicePeriodStart,
          periodEnd: invoicePeriodEnd,
          paidAt:
            typeof invoice.status_transitions?.paid_at === "number"
              ? new Date(invoice.status_transitions.paid_at * 1000)
              : null,
          discountAmountCents: invoiceDiscountCents(invoice),
          discountLabel: invoiceDiscountLabel(invoice),
        });
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
