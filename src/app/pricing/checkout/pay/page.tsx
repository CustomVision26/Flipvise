import { redirect } from "next/navigation";
import { auth } from "@/lib/clerk-auth";
import {
  PricingCheckoutPayment,
  type PricingCheckoutSummary,
} from "@/components/pricing-checkout-payment";
import type { PlanConfig } from "@/lib/plan-config-types";
import { isStripePaidPlanId } from "@/lib/billing-plan-ids";
import { getClerkUserFieldDisplayById } from "@/lib/clerk-user-display";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import { readPlansConfigFromDisk } from "@/lib/plans-config-disk";
import { resolveCheckoutPromoDisplay } from "@/lib/checkout-promo-display";
import { parsePricingBillingPeriod } from "@/lib/pricing-billing-period";
import { checkoutSessionAmountsMajor } from "@/lib/stripe-checkout-session-amounts";
import {
  fetchStripePricingForPaidPlans,
  mergePlansConfigWithStripePricing,
} from "@/lib/stripe-pricing-display";
import { stripe } from "@/lib/stripe";
import { isStripeCheckoutSessionId } from "@/lib/stripe-checkout-session-id";
import { publishedTrialDaysForPlan } from "@/lib/plan-trial";
import { toClientJson } from "@/lib/to-client-json";

export const dynamic = "force-dynamic";

interface PricingCheckoutPayPageProps {
  searchParams: Promise<{ session_id?: string }>;
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

export default async function PricingCheckoutPayPage({
  searchParams,
}: PricingCheckoutPayPageProps) {
  const { session_id: sessionIdParam } = await searchParams;
  const sessionId = sessionIdParam?.trim() ?? "";

  const { userId } = await auth();
  if (!userId) {
    redirect("/");
  }

  if (!isStripeCheckoutSessionId(sessionId)) {
    redirect("/pricing/checkout");
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["total_details.breakdown"],
    });
  } catch {
    redirect("/pricing/checkout");
  }
  if (session.metadata?.clerkUserId !== userId) {
    redirect("/pricing");
  }

  if (session.status === "complete") {
    redirect("/dashboard?checkout=success");
  }

  if (!session.client_secret) {
    redirect("/pricing/checkout");
  }

  const planId = session.metadata?.plan?.trim() ?? "";
  const period = parsePricingBillingPeriod(session.metadata?.period);
  const isTrial = session.metadata?.isTrial === "true";
  const promoQuery = isTrial ? "" : session.metadata?.promoCode?.trim();

  const backParams = new URLSearchParams();
  if (isStripePaidPlanId(planId)) backParams.set("plan", planId);
  if (period) backParams.set("period", period);
  if (isTrial) {
    backParams.set("trial", "1");
  } else if (promoQuery) {
    backParams.set("promo", promoQuery);
  }
  const backHref = backParams.size
    ? `/pricing/checkout?${backParams.toString()}`
    : "/pricing/checkout";

  let customerEmail =
    session.customer_details?.email?.trim() ||
    session.customer_email?.trim() ||
    null;
  if (!customerEmail) {
    const { primaryEmail } = await getClerkUserFieldDisplayById(userId);
    customerEmail = primaryEmail?.trim().toLowerCase() ?? null;
  }

  const plans = await loadPlansForPricingUi();
  const planRow = isStripePaidPlanId(planId)
    ? plans.find((p) => p.id === planId)
    : undefined;
  const promoDisplay = isTrial
    ? null
    : resolveCheckoutPromoDisplay({
        sessionPromoCode: session.metadata?.promoCode,
        sessionPromoKind: session.metadata?.promoKind,
        plan: planRow,
      });
  const stripeAmounts = checkoutSessionAmountsMajor(session);
  const trialDays =
    isTrial && planRow ? publishedTrialDaysForPlan(planRow) : null;

  const summary: PricingCheckoutSummary = {
    planLabel: planRow?.name ?? displayNameForBillingPlanSlug(
      isStripePaidPlanId(planId) ? planId : "pro",
    ),
    period,
    customerEmail,
    campaignLabel: isTrial ? null : planRow?.discount?.label?.trim() || null,
    promo: promoDisplay,
    isTrial,
    trialDays: trialDays && trialDays > 0 ? trialDays : null,
    monthlyRateAfterTrial:
      planRow?.monthlyPrice ?? stripeAmounts?.subtotalMajor ?? null,
    stripeAmounts,
  };

  return (
    <PricingCheckoutPayment
      clientSecret={session.client_secret}
      summary={toClientJson(summary)}
      backHref={backHref}
    />
  );
}
