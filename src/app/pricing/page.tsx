import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { StripeCheckoutToast } from "@/components/stripe-checkout-toast";
import { getAccessContext, guestAccessContext } from "@/lib/access";
import { resolvePricingBackToDashboardHref } from "@/lib/pricing-back-dashboard-href";
import { PricingContent } from "@/components/pricing-content";
import { ManageBillingButton } from "@/components/manage-billing-button";
import { buttonVariants } from "@/components/ui/button-variants";
import { getActiveStripeSubscription } from "@/db/queries/stripe-subscriptions";
import { resolvePricingPageHighlightId } from "@/lib/pricing-page-current-plan";
import { personalDashboardHrefWithUserPlanQuery } from "@/lib/personal-dashboard-url";
import { readPlansConfigFromDisk } from "@/lib/plans-config-disk";
import {
  fetchStripePricingForPaidPlans,
  mergePlansConfigWithStripePricing,
} from "@/lib/stripe-pricing-display";
import type { PlanConfig } from "@/components/pricing-content";

/** Stripe price snapshots must run at request time (env + live amounts). */
export const dynamic = "force-dynamic";

async function loadPlansForPricingUi(): Promise<PlanConfig[]> {
  try {
    const plansFromDisk = await readPlansConfigFromDisk();
    const stripePricing = await fetchStripePricingForPaidPlans();
    return mergePlansConfigWithStripePricing(plansFromDisk, stripePricing);
  } catch (error) {
    console.error("[PricingPage] loadPlansForPricingUi:", error);
    return readPlansConfigFromDisk();
  }
}

export default async function PricingPage() {
  let access = guestAccessContext();
  try {
    access = await getAccessContext();
  } catch (error) {
    console.error("[PricingPage] getAccessContext:", error);
  }

  const {
    userId,
    activeTeamPlan,
    isPro,
    hasClerkPersonalPro,
    hasClerkPersonalProPlus,
  } = access;

  const personalDashboardHref =
    userId != null
      ? personalDashboardHrefWithUserPlanQuery({
          userId,
          activeTeamPlan,
          isPro,
          hasClerkPersonalPro,
          hasClerkPersonalProPlus,
        })
      : "/";

  let backHref = userId != null ? personalDashboardHref : "/";
  if (userId != null) {
    try {
      backHref = await resolvePricingBackToDashboardHref({
        userId,
        activeTeamPlan,
        isPro,
        hasClerkPersonalPro,
        hasClerkPersonalProPlus,
      });
    } catch (error) {
      console.error("[PricingPage] resolvePricingBackToDashboardHref:", error);
      backHref = personalDashboardHref;
    }
  }

  let stripeSubRow: Awaited<ReturnType<typeof getActiveStripeSubscription>> = null;
  if (userId != null) {
    try {
      stripeSubRow = await getActiveStripeSubscription(userId);
    } catch (error) {
      console.error("[PricingPage] getActiveStripeSubscription:", error);
    }
  }

  const currentPlanHighlightId = resolvePricingPageHighlightId(
    access,
    stripeSubRow?.planSlug,
  );

  const plansForUi = await loadPlansForPricingUi();

  const hasStripeSubscription = stripeSubRow !== null;

  return (
    <div className="min-h-screen bg-background py-8 sm:py-16 px-3 sm:px-4">
      <Suspense fallback={null}>
        <StripeCheckoutToast />
      </Suspense>
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-10">

        {/* Back navigation */}
        <div className="flex justify-center">
          <Link
            href={backHref}
            className={
              buttonVariants({ variant: "ghost", size: "sm" }) + " gap-2"
            }
          >
            <ArrowLeft className="size-4" />
            {userId ? "Back to Dashboard" : "Back to Home"}
          </Link>
        </div>

        {/* Heading */}
        <div className="text-center space-y-2 sm:space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-2">
            Plans &amp; Pricing
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            Simple, Transparent Pricing
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base md:text-lg max-w-xl mx-auto px-4">
            Start for free. Upgrade anytime for higher deck limits, AI flashcards,
            optional AI reading on Pro Plus, and team workspaces.
          </p>
        </div>

        {/* Subscriber portal banner — shown only to users with an active Stripe subscription */}
        {hasStripeSubscription && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/40 px-6 py-5 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">
                You have an active subscription
              </p>
              <p className="text-xs text-muted-foreground">
                Upgrade, downgrade, cancel, or update your payment method through
                the Stripe billing portal. Proration is applied automatically.
              </p>
            </div>
            <ManageBillingButton
              label="Manage subscription"
              variant="outline"
              size="sm"
              className="shrink-0"
            />
          </div>
        )}

        {/* Pricing cards */}
        <PricingContent
          userId={userId}
          currentPlanHighlightId={currentPlanHighlightId}
          plans={plansForUi}
        />

      </div>
    </div>
  );
}
