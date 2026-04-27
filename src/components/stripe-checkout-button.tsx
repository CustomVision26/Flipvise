"use client";

import { useState, useTransition } from "react";
import { createStripeCheckoutSessionAction } from "@/actions/stripe";
import { Button } from "@/components/ui/button";
import { TEAM_PLAN_IDS, type TeamPlanId } from "@/lib/team-plans";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PAID_PLANS = ["pro", ...TEAM_PLAN_IDS] as const;
type PaidPlanId = "pro" | TeamPlanId;
type BillingPeriod = "monthly" | "yearly";

function isPaidPlanId(value: string): value is PaidPlanId {
  return (PAID_PLANS as readonly string[]).includes(value);
}

export function StripeCheckoutButton({
  plan = "pro",
  label = "Upgrade to Pro",
}: {
  plan?: PaidPlanId;
  label?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  function onCheckout() {
    setError(null);
    if (!isPaidPlanId(plan)) {
      setError("Unsupported plan selected.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createStripeCheckoutSessionAction({ plan, period });
        window.location.href = result.url;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to start checkout.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Tabs
        value={period}
        onValueChange={(value) => setPeriod(value as BillingPeriod)}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="yearly">Yearly</TabsTrigger>
        </TabsList>
      </Tabs>
      <Button type="button" size="lg" onClick={onCheckout} disabled={isPending} className="w-full">
        {isPending ? "Redirecting to Stripe..." : `${label} (${period})`}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
