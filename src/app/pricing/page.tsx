import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getAccessContext } from "@/lib/access";
import { personalDashboardHref } from "@/lib/personal-dashboard-url";
import { PricingBackToDashboardButton } from "@/components/pricing-back-to-dashboard-button";
import { PricingContent } from "@/components/pricing-content";
import { ManageBillingButton } from "@/components/manage-billing-button";
import { buttonVariants } from "@/components/ui/button-variants";
import { getActiveStripeSubscription } from "@/db/queries/stripe-subscriptions";

export default async function PricingPage() {
  const { userId, activeTeamPlan, isPro, isAdmin } = await getAccessContext();

  const personalDashboardLink =
    userId == null ? "/" : personalDashboardHref(userId, activeTeamPlan, isPro);

  const currentPaidPlan: string | null =
    activeTeamPlan ?? (isPro ? "pro" : null);

  // Check for an active Stripe subscription so we can surface the portal link.
  const hasStripeSubscription =
    userId != null
      ? (await getActiveStripeSubscription(userId)) !== null
      : false;

  return (
    <div className="min-h-screen bg-background py-8 sm:py-16 px-3 sm:px-4">
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-10">

        {/* Back navigation */}
        <div className="flex justify-center">
          {userId != null && activeTeamPlan !== null ? (
            <PricingBackToDashboardButton href={personalDashboardLink}>
              Back to Dashboard
            </PricingBackToDashboardButton>
          ) : (
            <Link
              href={personalDashboardLink}
              className={
                buttonVariants({ variant: "ghost", size: "sm" }) + " gap-2"
              }
            >
              <ArrowLeft className="size-4" />
              {userId ? "Back to Dashboard" : "Back to Home"}
            </Link>
          )}
        </div>

        {/* Heading */}
        <div className="text-center space-y-2 sm:space-y-3">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            Simple, Transparent Pricing
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base md:text-lg max-w-xl mx-auto px-4">
            Start for free. Upgrade anytime to unlock AI-powered flashcard
            generation, unlimited decks, and team collaboration.
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
          currentPaidPlan={currentPaidPlan}
        />

      </div>
    </div>
  );
}
