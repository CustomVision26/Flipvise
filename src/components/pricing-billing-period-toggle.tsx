"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PricingBillingPeriod } from "@/lib/pricing-billing-period";

export function PricingBillingPeriodToggle({
  period,
  onPeriodChange,
  className,
}: {
  period: PricingBillingPeriod;
  onPeriodChange: (period: PricingBillingPeriod) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-border/80 bg-muted/20 p-1",
        className,
      )}
      role="group"
      aria-label="Billing period"
    >
      <Button
        type="button"
        size="sm"
        variant={period === "monthly" ? "secondary" : "ghost"}
        className={cn(
          "h-9 min-w-[5.5rem] rounded-md px-4 text-sm font-medium",
          period === "monthly" && "shadow-sm",
        )}
        onClick={() => onPeriodChange("monthly")}
      >
        Monthly
      </Button>
      <Button
        type="button"
        size="sm"
        variant={period === "yearly" ? "secondary" : "ghost"}
        className={cn(
          "h-9 min-w-[5.5rem] gap-2 rounded-md px-4 text-sm font-medium",
          period === "yearly" && "shadow-sm",
        )}
        onClick={() => onPeriodChange("yearly")}
      >
        Yearly
        <Badge
          variant="outline"
          className="border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0 text-[10px] font-medium text-emerald-300"
        >
          Save
        </Badge>
      </Button>
    </div>
  );
}
