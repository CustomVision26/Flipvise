import { redirect } from "next/navigation";
import { auth } from "@/lib/clerk-auth";
import { PlanChangeContinueHandoff } from "@/components/plan-change-continue-handoff";
import { isStripePaidPlanId } from "@/lib/billing-plan-ids";
import { parsePricingBillingPeriod } from "@/lib/pricing-billing-period";
import { personalDashboardHrefAfterPlanChangeSuccess } from "@/lib/personal-dashboard-url";
import { isStripeSetupIntentId } from "@/lib/stripe-checkout-session-id";

export const dynamic = "force-dynamic";

interface PlanChangeContinuePageProps {
  searchParams: Promise<{
    plan?: string;
    period?: string;
    addon?: string;
    setup_intent?: string;
    setup_intent_client_secret?: string;
    redirect_status?: string;
  }>;
}

/**
 * Bridge after SetupIntent confirm when a locked add-on was selected with the
 * plan change — finalize the plan swap, then open add-on checkout in the same
 * browser session (two Stripe receipts: plan proration + add-on).
 */
export default async function PlanChangeContinuePage({
  searchParams,
}: PlanChangeContinuePageProps) {
  const params = await searchParams;
  const { userId } = await auth();
  if (!userId) redirect("/");

  const planId = params.plan?.trim() ?? "";
  const period = parsePricingBillingPeriod(params.period);
  const addonKey = params.addon?.trim() ?? "";
  const setupIntentId = params.setup_intent?.trim() ?? "";
  const redirectStatus = params.redirect_status?.trim() ?? "";

  const dashboardHref = isStripePaidPlanId(planId)
    ? personalDashboardHrefAfterPlanChangeSuccess({
        userId,
        purchasedPlanSlug: planId,
      })
    : "/dashboard?checkout=plan_change";

  const checkoutCanceledHref = `/pricing/checkout?plan=${encodeURIComponent(planId)}&period=${period}&checkout=canceled`;

  if (!isStripeSetupIntentId(setupIntentId)) {
    redirect(dashboardHref);
  }

  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <PlanChangeContinueHandoff
        setupIntentId={setupIntentId}
        addonKey={addonKey}
        period={period}
        dashboardHref={dashboardHref}
        checkoutCanceledHref={checkoutCanceledHref}
        redirectStatus={redirectStatus}
      />
    </div>
  );
}
