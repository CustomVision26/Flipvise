"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { STRIPE_PAID_PLAN_IDS, type StripePaidPlanId } from "@/lib/billing-plan-ids";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PaidPlanId = StripePaidPlanId;
type BillingPeriod = "monthly" | "yearly";

function isPaidPlanId(value: string): value is PaidPlanId {
  return (STRIPE_PAID_PLAN_IDS as readonly string[]).includes(value);
}
export function StripeCheckoutButton({
  plan = "pro",
  label = "Upgrade to Pro",
}: {
  plan?: PaidPlanId;
  label?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const router = useRouter();

  function onCheckout() {
    setError(null);
    if (!isPaidPlanId(plan)) {
      setError("Unsupported plan selected.");
      return;
    }
    router.push(
      `/pricing/checkout?plan=${encodeURIComponent(plan)}&period=${encodeURIComponent(period)}`,
    );
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
      <Button type="button" size="lg" onClick={onCheckout} className="w-full">
        {`${label} (${period})`}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
