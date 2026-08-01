"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createAddonCheckoutSessionAction } from "@/actions/addons";
import { finalizePlanChangePaymentAction } from "@/actions/plan-change-checkout";
import { clearPlanChangePendingAddon } from "@/lib/plan-change-pending-addon";
import type { PricingBillingPeriod } from "@/lib/pricing-billing-period";

type PlanChangeContinueHandoffProps = {
  setupIntentId: string;
  addonKey: string;
  period: PricingBillingPeriod;
  dashboardHref: string;
  checkoutCanceledHref: string;
  redirectStatus: string;
};

async function startAddonCheckoutWithRetry(input: {
  addonKey: string;
  period: PricingBillingPeriod;
}): Promise<string | null> {
  const delaysMs = [0, 800, 1_600, 3_000] as const;
  for (const delay of delaysMs) {
    if (delay > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, delay));
    }
    try {
      const session = await createAddonCheckoutSessionAction({
        addonKey: input.addonKey,
        period: input.period,
      });
      return session.sessionId;
    } catch (error) {
      console.error("[PlanChangeContinueHandoff] add-on checkout:", error);
    }
  }
  return null;
}

/**
 * After SetupIntent confirm: finalize plan change, then open add-on checkout
 * in the same browser session (separate Stripe receipts).
 */
export function PlanChangeContinueHandoff({
  setupIntentId,
  addonKey,
  period,
  dashboardHref,
  checkoutCanceledHref,
  redirectStatus,
}: PlanChangeContinueHandoffProps) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      clearPlanChangePendingAddon();

      if (redirectStatus && redirectStatus !== "succeeded") {
        router.replace(checkoutCanceledHref);
        return;
      }

      try {
        await finalizePlanChangePaymentAction({ setupIntentId });
      } catch (error) {
        console.error("[PlanChangeContinueHandoff] finalize:", error);
        router.replace(dashboardHref);
        return;
      }

      if (!addonKey) {
        router.replace(dashboardHref);
        return;
      }

      const sessionId = await startAddonCheckoutWithRetry({ addonKey, period });
      if (!sessionId) {
        const join = dashboardHref.includes("?") ? "&" : "?";
        router.replace(`${dashboardHref}${join}addon_checkout=failed`);
        return;
      }

      window.location.assign(
        `/pricing/add-ons/pay?session_id=${encodeURIComponent(sessionId)}&from_plan_change=1`,
      );
    })();
  }, [
    addonKey,
    checkoutCanceledHref,
    dashboardHref,
    period,
    redirectStatus,
    router,
    setupIntentId,
  ]);

  return (
    <div className="mx-auto flex min-h-[40vh] w-full max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm font-medium text-foreground">Finishing plan change…</p>
      <p className="text-sm text-muted-foreground">
        {addonKey
          ? "Next you’ll confirm the selected add-on checkout (separate receipt)."
          : "Taking you to your dashboard."}
      </p>
    </div>
  );
}
