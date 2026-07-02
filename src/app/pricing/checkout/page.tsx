import { redirect } from "next/navigation";
import { PricingCheckoutStep } from "@/components/pricing-checkout-step";
import type { PlanConfig } from "@/lib/plan-config-types";
import { getAccessContext, guestAccessContext } from "@/lib/access";
import { isStripePaidPlanId } from "@/lib/billing-plan-ids";
import { parsePricingBillingPeriod } from "@/lib/pricing-billing-period";
import { readPlansConfigFromDisk } from "@/lib/plans-config-disk";
import {
  fetchStripePricingForPaidPlans,
  mergePlansConfigWithStripePricing,
} from "@/lib/stripe-pricing-display";
import { toClientJson } from "@/lib/to-client-json";
import {
  fetchPlanChangeProrationPreview,
  resolvePlanChangeCheckoutContext,
} from "@/lib/plan-change-proration-preview";

export const dynamic = "force-dynamic";

interface PricingCheckoutPageProps {
  searchParams: Promise<{
    plan?: string;
    period?: string;
    promo?: string;
    checkout?: string;
    trial?: string;
  }>;
}

async function loadPlansForPricingUi(): Promise<PlanConfig[]> {
  try {
    const plansFromDisk = await readPlansConfigFromDisk();
    const stripePricing = await fetchStripePricingForPaidPlans();
    return mergePlansConfigWithStripePricing(plansFromDisk, stripePricing);
  } catch {
    return readPlansConfigFromDisk();
  }
}

export default async function PricingCheckoutPage({
  searchParams,
}: PricingCheckoutPageProps) {
  const { plan: planParam, period, promo, checkout, trial } = await searchParams;

  let access = guestAccessContext();
  try {
    access = await getAccessContext();
  } catch {
    // fall through — redirect below if unsigned in
  }

  if (!access.userId) {
    redirect("/");
  }

  const planId = planParam?.trim() ?? "";
  if (!isStripePaidPlanId(planId)) {
    redirect("/pricing");
  }

  const plans = await loadPlansForPricingUi();
  const plan = plans.find((p) => p.id === planId);
  if (!plan || plan.id === "free") {
    redirect("/pricing");
  }

  const initialPeriod = parsePricingBillingPeriod(period);
  const planChangeBase = await resolvePlanChangeCheckoutContext(
    access.userId,
    planId,
  );
  const planChangeContext =
    planChangeBase != null
      ? {
          ...planChangeBase,
          initialPreview: await fetchPlanChangeProrationPreview({
            userId: access.userId,
            planSlug: planId,
            period: initialPeriod,
          }),
        }
      : null;

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-6 sm:py-14">
      <PricingCheckoutStep
        planId={planId}
        plan={toClientJson(plan)}
        initialPeriod={initialPeriod}
        initialPromotionCode={trial === "1" ? "" : (promo?.trim() ?? "")}
        checkoutCanceled={checkout === "canceled"}
        planChangeContext={planChangeContext ? toClientJson(planChangeContext) : null}
        startTrial={trial === "1"}
      />
    </div>
  );
}
