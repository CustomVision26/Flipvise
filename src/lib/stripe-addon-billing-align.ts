import type Stripe from "stripe";
import {
  getActiveStripeSubscription,
  getManageableStripeSubscription,
} from "@/db/queries/stripe-subscriptions";
import { isStripeAddonSubscription } from "@/lib/stripe-addon-metadata";
import type { AddonBillingPeriod } from "@/lib/stripe-addon-price-env";
import { stripe } from "@/lib/stripe";

const MIN_ANCHOR_LEAD_SECONDS = 2 * 60 * 60; // Stripe needs a future anchor with headroom

/** Max seconds from now that Stripe allows for billing_cycle_anchor (≈ first interval). */
function maxAnchorLeadSeconds(period: AddonBillingPeriod): number {
  return period === "yearly"
    ? 366 * 24 * 60 * 60
    : 31 * 24 * 60 * 60;
}

function clampDayOfMonth(year: number, monthIndex: number, day: number): number {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Math.min(Math.max(1, day), lastDay);
}

function baseSubscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const item = sub.items.data[0] as
    | (Stripe.SubscriptionItem & { current_period_end?: number })
    | undefined;
  if (typeof item?.current_period_end === "number") {
    return new Date(item.current_period_end * 1000);
  }
  const top = sub as Stripe.Subscription & { current_period_end?: number };
  if (typeof top.current_period_end === "number") {
    return new Date(top.current_period_end * 1000);
  }
  return null;
}

/**
 * Next UTC instant on/after `now` that matches the calendar day-of-month (and
 * time-of-day) of `periodEnd`, within one add-on interval when possible.
 */
function nextMatchingDayAnchor(periodEnd: Date, nowMs: number): Date {
  const day = periodEnd.getUTCDate();
  const hour = periodEnd.getUTCHours();
  const minute = periodEnd.getUTCMinutes();
  const second = periodEnd.getUTCSeconds();
  const now = new Date(nowMs);

  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  let dayClamped = clampDayOfMonth(year, month, day);
  let candidate = new Date(
    Date.UTC(year, month, dayClamped, hour, minute, second),
  );

  if (candidate.getTime() < nowMs + MIN_ANCHOR_LEAD_SECONDS) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    dayClamped = clampDayOfMonth(year, month, day);
    candidate = new Date(
      Date.UTC(year, month, dayClamped, hour, minute, second),
    );
  }

  return candidate;
}

async function resolveBasePlanPeriodEnd(
  userId: string,
): Promise<Date | null> {
  const row =
    (await getActiveStripeSubscription(userId)) ??
    (await getManageableStripeSubscription(userId));
  if (!row?.stripeSubscriptionId) return null;

  try {
    const sub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId, {
      expand: ["items.data"],
    });
    if (isStripeAddonSubscription(sub)) return null;
    if (sub.status !== "active" && sub.status !== "trialing") return null;

    return baseSubscriptionPeriodEnd(sub);
  } catch {
    if (row.currentPeriodEnd && row.currentPeriodEnd.getTime() > Date.now()) {
      return row.currentPeriodEnd;
    }
    return null;
  }
}

export type AddonCheckoutAlignment = {
  /** Unix seconds for Checkout `subscription_data.billing_cycle_anchor`. */
  billingCycleAnchor: number;
  /** ISO timestamp of the aligned renewal / first full invoice date. */
  alignsWithPeriodEndIso: string;
  /** Whether the anchor is the base plan’s exact period end (vs next matching day). */
  usesBasePeriodEnd: boolean;
};

/**
 * Align a standalone add-on subscription to the user’s base plan renewal date
 * so Checkout charges a prorated amount until that date, then renews on the
 * same cadence day. Returns null when there is no usable base plan period.
 */
export async function resolveAddonCheckoutAlignment(
  userId: string,
  addonPeriod: AddonBillingPeriod,
  nowMs: number = Date.now(),
): Promise<AddonCheckoutAlignment | null> {
  const periodEnd = await resolveBasePlanPeriodEnd(userId);
  if (!periodEnd) return null;

  const periodEndMs = periodEnd.getTime();
  if (periodEndMs < nowMs + MIN_ANCHOR_LEAD_SECONDS) return null;

  const maxLeadMs = maxAnchorLeadSeconds(addonPeriod) * 1000;
  let anchorDate: Date;
  let usesBasePeriodEnd: boolean;

  if (periodEndMs <= nowMs + maxLeadMs) {
    anchorDate = periodEnd;
    usesBasePeriodEnd = true;
  } else {
    // Monthly add-on under a far-out yearly base renewal: same day-of-month next.
    anchorDate = nextMatchingDayAnchor(periodEnd, nowMs);
    usesBasePeriodEnd = false;
    if (anchorDate.getTime() > nowMs + maxLeadMs) return null;
  }

  const billingCycleAnchor = Math.floor(anchorDate.getTime() / 1000);
  if (billingCycleAnchor <= Math.floor(nowMs / 1000) + MIN_ANCHOR_LEAD_SECONDS) {
    return null;
  }

  return {
    billingCycleAnchor,
    alignsWithPeriodEndIso: anchorDate.toISOString(),
    usesBasePeriodEnd,
  };
}

/** Checkout `subscription_data` fields for aligned prorated add-on billing. */
export function addonCheckoutSubscriptionAlignParams(
  alignment: AddonCheckoutAlignment,
): {
  billing_cycle_anchor: number;
  proration_behavior: "create_prorations";
} {
  return {
    billing_cycle_anchor: alignment.billingCycleAnchor,
    proration_behavior: "create_prorations",
  };
}
