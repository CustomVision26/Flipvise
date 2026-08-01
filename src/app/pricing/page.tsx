import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { StripeCheckoutToast } from "@/components/stripe-checkout-toast";
import { getAccessContext, guestAccessContext } from "@/lib/access";
import { resolvePricingBackToDashboardHref } from "@/lib/pricing-back-dashboard-href";
import { PricingContent } from "@/components/pricing-content";
import {
  activeGeneralDiscountPlanIds,
  activePublicPromoCodes,
  pricingHasActivePromoUi,
} from "@/lib/plan-promo-window";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { getActiveStripeSubscription, getManageableStripeSubscription } from "@/db/queries/stripe-subscriptions";
import { hasUserConsumedPlanTrial } from "@/db/queries/user-plan-trials";
import { resolvePricingPageHighlightId } from "@/lib/pricing-page-current-plan";
import { personalDashboardHrefWithUserPlanQuery } from "@/lib/personal-dashboard-url";
import { readPlansConfigFromDisk } from "@/lib/plans-config-disk";
import {
  fetchStripePricingForPaidPlans,
  mergePlansConfigWithStripePricing,
} from "@/lib/stripe-pricing-display";
import type { PlanConfig } from "@/components/pricing-content";
import { getAddonCatalogSettings } from "@/db/queries/addons";

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

interface PricingPageProps {
  searchParams: Promise<{ promo?: string }>;
}

export default async function PricingPage({ searchParams }: PricingPageProps) {
  const { promo: promoFromUrl } = await searchParams;

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
  let hasUsedTrial = false;
  let hasActiveSubscription = false;
  if (userId != null) {
    try {
      const [activeSub, manageableSub, usedTrial] = await Promise.all([
        getActiveStripeSubscription(userId),
        getManageableStripeSubscription(userId),
        hasUserConsumedPlanTrial(userId),
      ]);
      stripeSubRow = activeSub;
      hasUsedTrial = usedTrial;
      hasActiveSubscription = manageableSub != null;
    } catch (error) {
      console.error("[PricingPage] subscription/trial lookup:", error);
    }
  }

  const currentPlanHighlightId = resolvePricingPageHighlightId(
    access,
    stripeSubRow?.planSlug,
  );

  const plansForUi = await loadPlansForPricingUi();
  const promoNowMs = Date.now();
  const showPromotionCodeUi = pricingHasActivePromoUi(plansForUi, promoNowMs);
  const publicPromoCodes = activePublicPromoCodes(plansForUi, promoNowMs);
  const activeDiscountPlanIds = activeGeneralDiscountPlanIds(
    plansForUi,
    promoNowMs,
  );

  let showAddonCatalogLink = false;
  try {
    const addonSettings = await getAddonCatalogSettings();
    showAddonCatalogLink = addonSettings.pricingCatalogVisible;
  } catch (error) {
    console.error("[PricingPage] addon catalog settings:", error);
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-6 sm:py-14">
      <Suspense fallback={null}>
        <StripeCheckoutToast />
      </Suspense>
      <div className="mx-auto flex max-w-5xl flex-col gap-8 sm:gap-10">
        <div className="flex flex-col gap-6">
          <Link
            href={backHref}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "w-fit gap-1.5 text-muted-foreground hover:text-foreground",
            )}
          >
            <ArrowLeft className="size-3.5" />
            {userId ? "Back to Dashboard" : "Back to Home"}
          </Link>

          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Plans &amp; Pricing
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl md:text-[2rem] md:leading-tight">
              Simple, transparent pricing
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
              Start for free. Upgrade anytime for higher deck limits, AI flashcards,
              optional AI reading on Pro Plus, and team workspaces.
            </p>
            {showAddonCatalogLink ? (
              <p className="mt-4">
                <Link
                  href="/pricing/add-ons"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "inline-flex",
                  )}
                >
                  Browse Add-on Catalog
                </Link>
              </p>
            ) : null}
          </div>
        </div>

        <PricingContent
          userId={userId}
          currentPlanHighlightId={currentPlanHighlightId}
          plans={plansForUi}
          initialPromotionCode={promoFromUrl?.trim() ?? ""}
          hasUsedTrial={hasUsedTrial}
          hasActiveSubscription={hasActiveSubscription}
          showPromotionCodeUi={showPromotionCodeUi}
          publicPromoCodes={publicPromoCodes}
          activeDiscountPlanIds={activeDiscountPlanIds}
        />
      </div>
    </div>
  );
}
