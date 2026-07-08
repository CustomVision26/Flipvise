import type { StripePaidPlanId } from "@/lib/billing-plan-ids";
import {
  fetchUpgradableStripeSubscription,
  type UpgradableStripeSubscription,
} from "@/lib/apply-plan-upgrade";
import { readPlansConfigFromDisk } from "@/lib/plans-config-disk";
import { resolveCatalogAlignedStripePriceId } from "@/lib/stripe-catalog-price";
import { resolveStripePriceIdForPlan } from "@/lib/stripe-plan-price-env";
import { stripe } from "@/lib/stripe";
import { STRIPE_CLEAR_DISCOUNTS } from "@/lib/stripe-clear-discounts";
import { asPaidPlanId } from "@/lib/stripe-billing-sync";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";

export type PlanChangePreviewLine = {
  description: string;
  amountCents: number;
  isProration: boolean;
};

export type PlanChangeProrationPreview = {
  amountDueCents: number;
  currency: string;
  /** Sum of proration credits (negative line items), if any. */
  creditCents: number | null;
  /** Sum of proration charges (positive line items), if any. */
  chargeCents: number | null;
  lines: PlanChangePreviewLine[];
};

async function resolveTargetPriceId(
  planSlug: StripePaidPlanId,
  period: "monthly" | "yearly",
): Promise<string | null> {
  try {
    const plansConfig = await readPlansConfigFromDisk();
    const planRow = plansConfig.find((p) => p.id === planSlug);
    if (planRow) {
      return await resolveCatalogAlignedStripePriceId({
        plan: planSlug,
        period,
        monthlyPrice: planRow.monthlyPrice,
        yearlyMonthlyPrice: planRow.yearlyMonthlyPrice,
      });
    }
    return resolveStripePriceIdForPlan(planSlug, period);
  } catch (error) {
    console.error("[resolveTargetPriceId]", { planSlug, period, error });
    return resolveStripePriceIdForPlan(planSlug, period);
  }
}

async function detectBillingPeriod(
  subscriptionId: string,
): Promise<"monthly" | "yearly"> {
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    });
    const interval = (
      sub.items?.data?.[0]?.price as { recurring?: { interval?: string } }
    )?.recurring?.interval;
    return interval === "year" ? "yearly" : "monthly";
  } catch {
    return "monthly";
  }
}

function priceIdOnItem(
  item: { price?: string | { id?: string } | null } | undefined,
): string | null {
  const p = item?.price;
  if (typeof p === "string") return p;
  if (p && typeof p === "object" && typeof p.id === "string") return p.id;
  return null;
}

export type PlanChangeCheckoutContext = {
  isPlanChange: true;
  currentPlanSlug: StripePaidPlanId;
  currentPlanLabel: string;
  currentPeriod: "monthly" | "yearly";
  targetPlanSlug: StripePaidPlanId;
  targetPlanLabel: string;
};

export async function resolvePlanChangeCheckoutContext(
  userId: string,
  targetPlanSlug: StripePaidPlanId,
): Promise<PlanChangeCheckoutContext | null> {
  const live = await fetchUpgradableStripeSubscription(userId);
  if (!live) return null;

  const sub = await stripe.subscriptions.retrieve(live.subscriptionId, {
    expand: ["items.data.price"],
  });
  const currentPlanSlug = asPaidPlanId(sub.metadata?.plan);
  if (!currentPlanSlug) return null;

  return {
    isPlanChange: true,
    currentPlanSlug,
    currentPlanLabel: displayNameForBillingPlanSlug(currentPlanSlug),
    currentPeriod: await detectBillingPeriod(live.subscriptionId),
    targetPlanSlug,
    targetPlanLabel: displayNameForBillingPlanSlug(targetPlanSlug),
  };
}

export async function isSamePlanAndPeriod(input: {
  live: UpgradableStripeSubscription;
  targetPlanSlug: StripePaidPlanId;
  targetPeriod: "monthly" | "yearly";
}): Promise<boolean> {
  const sub = await stripe.subscriptions.retrieve(input.live.subscriptionId, {
    expand: ["items.data.price"],
  });
  const currentPlan = sub.metadata?.plan?.trim();
  const currentPeriod = await detectBillingPeriod(input.live.subscriptionId);
  const targetPriceId = await resolveTargetPriceId(
    input.targetPlanSlug,
    input.targetPeriod,
  );
  const currentPriceId = priceIdOnItem(sub.items?.data?.[0]);
  return (
    currentPlan === input.targetPlanSlug &&
    currentPeriod === input.targetPeriod &&
    targetPriceId != null &&
    currentPriceId === targetPriceId
  );
}

function stripDiscountSuffixFromDescription(description: string): string {
  return description.replace(/\s*\(with [\d.]+% off\)/i, "").trim();
}

function sanitizeTargetPlanChargeLines(input: {
  lines: PlanChangePreviewLine[];
  targetPlanLabel: string;
  targetPlanDiscountActive: boolean;
}): PlanChangePreviewLine[] {
  if (input.targetPlanDiscountActive) return input.lines;

  const target = input.targetPlanLabel.toLowerCase();
  return input.lines.map((line) => {
    const mentionsTarget = line.description.toLowerCase().includes(target);
    if (!mentionsTarget || line.amountCents <= 0) return line;
    return {
      ...line,
      description: stripDiscountSuffixFromDescription(line.description),
    };
  });
}

export async function fetchPlanChangeProrationPreview(input: {
  userId: string;
  planSlug: StripePaidPlanId;
  period: "monthly" | "yearly";
}): Promise<PlanChangeProrationPreview | null> {
  try {
    const live = await fetchUpgradableStripeSubscription(input.userId);
    if (!live) return null;

    const newPriceId = await resolveTargetPriceId(input.planSlug, input.period);
    if (!newPriceId) return null;

    if (
      await isSamePlanAndPeriod({
        live,
        targetPlanSlug: input.planSlug,
        targetPeriod: input.period,
      })
    ) {
      return {
        amountDueCents: 0,
        currency: "USD",
        creditCents: null,
        chargeCents: null,
        lines: [],
      };
    }

    const plansConfig = await readPlansConfigFromDisk();
    const targetPlanRow = plansConfig.find((p) => p.id === input.planSlug);
    const targetPlanDiscountActive = Boolean(targetPlanRow?.discount?.active);
    const prorationDate = Math.floor(Date.now() / 1000);
    const preview = await stripe.invoices.createPreview({
      customer: live.customerId,
      subscription: live.subscriptionId,
      /** Clear inherited Pro promo — Pro Plus (and future plan) must bill at list price. */
      discounts: STRIPE_CLEAR_DISCOUNTS,
      subscription_details: {
        items: [
          {
            id: live.itemId,
            price: newPriceId,
            discounts: STRIPE_CLEAR_DISCOUNTS,
          },
        ],
        proration_behavior: "always_invoice",
        proration_date: prorationDate,
      },
    });

    const currency = (preview.currency ?? "usd").toUpperCase();
    let creditCents = 0;
    let chargeCents = 0;
    const lines: PlanChangePreviewLine[] = [];

    for (const line of preview.lines?.data ?? []) {
      const amount = line.amount ?? 0;
      const isProration = Boolean((line as { proration?: boolean }).proration);
      const description =
        line.description?.trim() || "Subscription adjustment";

      lines.push({ description, amountCents: amount, isProration });

      if (!isProration) continue;
      if (amount < 0) creditCents += Math.abs(amount);
      else if (amount > 0) chargeCents += amount;
    }

    const amountDueCents =
      typeof preview.amount_due === "number" ? preview.amount_due : 0;

    const targetPlanLabel = displayNameForBillingPlanSlug(input.planSlug);
    const sanitizedLines = sanitizeTargetPlanChargeLines({
      lines,
      targetPlanLabel,
      targetPlanDiscountActive,
    });

    return {
      amountDueCents,
      currency,
      creditCents: creditCents > 0 ? creditCents : null,
      chargeCents: chargeCents > 0 ? chargeCents : null,
      lines: sanitizedLines,
    };
  } catch (error) {
    console.error("[fetchPlanChangeProrationPreview]", error);
    return null;
  }
}
