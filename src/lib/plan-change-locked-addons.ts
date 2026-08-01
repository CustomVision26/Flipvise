import {
  getAddonCatalogByKey,
  getAddonCatalogSettings,
  isPlanEligibleForAddon,
  listActiveUserAddonEntitlements,
  listPublishedActiveAddonsForPricing,
} from "@/db/queries/addons";
import { fetchUpgradableStripeSubscription } from "@/lib/apply-plan-upgrade";
import type { PricingBillingPeriod } from "@/lib/pricing-billing-period";
import {
  addonCheckoutSubscriptionAlignParams,
  resolveAddonCheckoutAlignment,
} from "@/lib/stripe-addon-billing-align";
import { stripe } from "@/lib/stripe";
import {
  resolveStripeAddonPriceIdFromEnvKey,
  type AddonBillingPeriod,
} from "@/lib/stripe-addon-price-env";
import { resolveAddonStripePriceLabels } from "@/lib/stripe-addon-price-display";
import { majorPerBillingCycleFromSubscriptionPrice } from "@/lib/stripe-pricing-display";
import type Stripe from "stripe";

export type PlanChangeLockedAddonOffer = {
  key: string;
  name: string;
  blurb: string;
  monthlyLabel: string | null;
  yearlyLabel: string | null;
  monthlyConfigured: boolean;
  yearlyConfigured: boolean;
};

/**
 * Locked (not already entitled) published add-ons eligible for the target plan,
 * only when the admin pricing catalog is visible.
 */
export async function loadPlanChangeLockedAddonOffers(input: {
  userId: string;
  targetPlanSlug: string;
}): Promise<PlanChangeLockedAddonOffer[]> {
  const settings = await getAddonCatalogSettings();
  if (!settings.pricingCatalogVisible) return [];

  const [published, entitlements] = await Promise.all([
    listPublishedActiveAddonsForPricing(),
    listActiveUserAddonEntitlements(input.userId),
  ]);
  const owned = new Set(entitlements.map((row) => row.addonKey));

  const candidates = published.filter((row) => {
    if (owned.has(row.key)) return false;
    if (!isPlanEligibleForAddon(row.eligiblePlanIds, input.targetPlanSlug)) {
      return false;
    }
    const monthlyOk = Boolean(
      resolveStripeAddonPriceIdFromEnvKey(row.stripePriceEnvKey, "monthly"),
    );
    const yearlyOk = Boolean(
      resolveStripeAddonPriceIdFromEnvKey(row.stripePriceEnvKey, "yearly"),
    );
    return monthlyOk || yearlyOk;
  });

  const offers = await Promise.all(
    candidates.map(async (row) => {
      const labels = await resolveAddonStripePriceLabels(row.stripePriceEnvKey);
      return {
        key: row.key,
        name: row.name,
        blurb: row.marketingBlurb || row.description,
        monthlyLabel: labels.monthlyLabel,
        yearlyLabel: labels.yearlyLabel,
        monthlyConfigured: labels.monthlyConfigured,
        yearlyConfigured: labels.yearlyConfigured,
      } satisfies PlanChangeLockedAddonOffer;
    }),
  );

  return offers.filter(
    (offer) => offer.monthlyConfigured || offer.yearlyConfigured,
  );
}

/** Display line for a selected locked add-on on plan-change pay summary. */
export type PlanChangeSelectedAddonLine = {
  key: string;
  name: string;
  description: string;
  /** Amount due for the first add-on invoice (prorated when aligned). */
  amountCents: number;
  /** Full cycle list price before proration. */
  listPriceCents: number;
  currency: string;
  isProrated: boolean;
  /** ISO date the prorated charge covers through (base plan renewal alignment). */
  alignsThroughIso: string | null;
};

function fullPeriodSecondsForPrice(
  price: Stripe.Price,
  period: AddonBillingPeriod,
): number {
  const rec = price.recurring;
  if (rec) {
    const n = rec.interval_count ?? 1;
    switch (rec.interval) {
      case "year":
        return n * 365.25 * 24 * 60 * 60;
      case "month":
        return n * (365.25 / 12) * 24 * 60 * 60;
      case "week":
        return n * 7 * 24 * 60 * 60;
      case "day":
        return n * 24 * 60 * 60;
      default:
        break;
    }
  }
  return period === "yearly"
    ? 365.25 * 24 * 60 * 60
    : (365.25 / 12) * 24 * 60 * 60;
}

function timeBasedProratedCents(input: {
  listPriceCents: number;
  price: Stripe.Price;
  period: AddonBillingPeriod;
  billingCycleAnchor: number;
  nowMs?: number;
}): number {
  const nowSec = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const remaining = Math.max(0, input.billingCycleAnchor - nowSec);
  const full = fullPeriodSecondsForPrice(input.price, input.period);
  if (full <= 0) return input.listPriceCents;
  const fraction = Math.min(1, remaining / full);
  return Math.max(0, Math.round(input.listPriceCents * fraction));
}

async function previewAlignedAddonAmountDueCents(input: {
  customerId: string;
  priceId: string;
  billingCycleAnchor: number;
}): Promise<number | null> {
  try {
    const preview = await stripe.invoices.createPreview({
      customer: input.customerId,
      subscription_details: {
        items: [{ price: input.priceId, quantity: 1 }],
        ...addonCheckoutSubscriptionAlignParams({
          billingCycleAnchor: input.billingCycleAnchor,
          alignsWithPeriodEndIso: new Date(
            input.billingCycleAnchor * 1000,
          ).toISOString(),
          usesBasePeriodEnd: true,
        }),
      },
    });
    if (typeof preview.amount_due === "number") {
      return Math.max(0, preview.amount_due);
    }
    return null;
  } catch (error) {
    console.error("[previewAlignedAddonAmountDueCents]", error);
    return null;
  }
}

/**
 * Resolve add-on line for plan-change checkout — prorated when billing can
 * align to the base plan renewal (same behavior as add-on Checkout).
 */
export async function resolvePlanChangeSelectedAddonLine(input: {
  userId: string;
  addonKey: string;
  period: PricingBillingPeriod;
}): Promise<PlanChangeSelectedAddonLine | null> {
  const key = input.addonKey.trim();
  if (!key) return null;

  const catalog = await getAddonCatalogByKey(key);
  if (!catalog || !catalog.active || !catalog.publishedOnPricing) return null;

  const period = input.period as AddonBillingPeriod;
  const priceId = resolveStripeAddonPriceIdFromEnvKey(
    catalog.stripePriceEnvKey,
    period,
  );
  if (!priceId) return null;

  try {
    const price = await stripe.prices.retrieve(priceId, {
      expand: ["currency_options", "tiers"],
    });
    if (!price.active) return null;
    const major = majorPerBillingCycleFromSubscriptionPrice(price);
    if (major == null) return null;
    const currency = (price.currency ?? "usd").toUpperCase();
    const listPriceCents = Math.round(major * 100);
    const periodLabel = period === "yearly" ? "yearly" : "monthly";

    const [alignment, live] = await Promise.all([
      resolveAddonCheckoutAlignment(input.userId, period),
      fetchUpgradableStripeSubscription(input.userId),
    ]);

    if (!alignment) {
      return {
        key: catalog.key,
        name: catalog.name,
        description: `${catalog.name} add-on (${periodLabel} list price)`,
        amountCents: listPriceCents,
        listPriceCents,
        currency,
        isProrated: false,
        alignsThroughIso: null,
      };
    }

    let amountCents: number | null = null;
    if (live?.customerId) {
      amountCents = await previewAlignedAddonAmountDueCents({
        customerId: live.customerId,
        priceId,
        billingCycleAnchor: alignment.billingCycleAnchor,
      });
    }
    if (amountCents == null) {
      amountCents = timeBasedProratedCents({
        listPriceCents,
        price,
        period,
        billingCycleAnchor: alignment.billingCycleAnchor,
      });
    }

    const through = new Date(alignment.alignsWithPeriodEndIso);
    const throughLabel = Number.isNaN(through.getTime())
      ? null
      : through.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });

    return {
      key: catalog.key,
      name: catalog.name,
      description: throughLabel
        ? `${catalog.name} add-on (prorated through ${throughLabel})`
        : `${catalog.name} add-on (prorated to plan renewal)`,
      amountCents,
      listPriceCents,
      currency,
      isProrated: amountCents < listPriceCents,
      alignsThroughIso: alignment.alignsWithPeriodEndIso,
    };
  } catch (error) {
    console.error("[resolvePlanChangeSelectedAddonLine]", { key, period, error });
    return null;
  }
}
