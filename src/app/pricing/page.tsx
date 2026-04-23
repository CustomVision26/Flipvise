import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getAccessContext } from "@/lib/access";
import { personalDashboardHref } from "@/lib/personal-dashboard-url";
import { ClerkPricingTable } from "@/components/clerk-pricing-table";
import { PricingBackToDashboardButton } from "@/components/pricing-back-to-dashboard-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button-variants";

export default async function PricingPage() {
  const { userId, activeTeamPlan, isPro, isAdmin } = await getAccessContext();

  /** Personal workspace (not a team `?team=` URL) — same shape as the header “Personal” link after checkout. */
  const personalDashboardLink =
    userId == null ? "/" : personalDashboardHref(userId, activeTeamPlan, isPro);

  return (
    <div className="min-h-screen bg-background py-8 sm:py-16 px-3 sm:px-4">
      <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
        <div className="flex justify-center mb-4">
          {userId != null && activeTeamPlan !== null ? (
            <PricingBackToDashboardButton href={personalDashboardLink}>
              Back to Dashboard
            </PricingBackToDashboardButton>
          ) : (
            <Link
              href={personalDashboardLink}
              className={buttonVariants({ variant: "ghost", size: "sm" }) + " gap-2"}
            >
              <ArrowLeft className="size-4" />
              {userId ? "Back to Dashboard" : "Back to Home"}
            </Link>
          )}
        </div>
        <div className="text-center space-y-2 sm:space-y-3">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            Simple, Transparent Pricing
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base md:text-lg px-4">
            Start for free. Upgrade anytime to unlock AI-powered flashcard
            generation and unlimited decks.
          </p>
        </div>

        {isAdmin && (
          <Alert className="max-w-4xl mx-auto">
            <AlertTitle>Team plans for platform administrators</AlertTitle>
            <AlertDescription>
              Platform administrators cannot subscribe to team-tier plans or create team workspaces.
              Access to a subscriber&apos;s team workspace is by invitation only (as team admin or team
              member). Your personal workspace uses Pro features granted with the administrator role.
            </AlertDescription>
          </Alert>
        )}

        <div className="max-w-4xl mx-auto">
          <ClerkPricingTable newSubscriptionRedirectUrl={personalDashboardLink} />
        </div>
      </div>
    </div>
  );
}
