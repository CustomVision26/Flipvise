"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, ChevronDown, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { createStripeCheckoutSessionAction } from "@/actions/stripe";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { TeamPlanId } from "@/lib/team-plans";
import plansConfigData from "@/data/plans-config.json";

type PaidPlanId = "pro" | TeamPlanId;
type BillingPeriod = "monthly" | "yearly";
type AnyPlanId = "free" | PaidPlanId;

export type PlanDiscount = {
  active: boolean;
  type: "percentage" | "fixed";
  value: number;
  label: string;
  stripeCouponId: string;
};

export type PlanConfig = {
  id: string;
  name: string;
  monthlyPrice: number | null;
  yearlyMonthlyPrice: number | null;
  description: string;
  features: string[];
  highlighted?: boolean;
  discount?: PlanDiscount;
};

/** Returns the discounted price given a base price and discount config. */
export function applyDiscount(price: number, discount: PlanDiscount): number {
  if (!discount.active || discount.value <= 0) return price;
  if (discount.type === "percentage") {
    return Math.max(0, price - price * (discount.value / 100));
  }
  return Math.max(0, price - discount.value);
}

const PLANS: PlanConfig[] = plansConfigData as PlanConfig[];

function PlanCard({
  plan,
  period,
  isCurrent,
  userId,
  isPending,
  error,
  onCheckout,
}: {
  plan: PlanConfig;
  period: BillingPeriod;
  isCurrent: boolean;
  userId: string | null;
  isPending: boolean;
  error: string | null;
  onCheckout: (planId: PaidPlanId) => void;
}) {
  const basePrice =
    period === "monthly" ? plan.monthlyPrice : plan.yearlyMonthlyPrice;
  const discount = plan.discount;
  const hasActiveDiscount =
    !!discount?.active && !!discount.value && basePrice !== null;
  const price = hasActiveDiscount && basePrice !== null
    ? applyDiscount(basePrice, discount!)
    : basePrice;
  const isFree = plan.id === "free";
  const isPaid = !isFree;

  const cta = (() => {
    if (!userId) {
      return (
        <Link
          href="/"
          className={cn(buttonVariants({ size: "lg" }), "w-full justify-center")}
        >
          Sign in to get started
        </Link>
      );
    }
    if (isFree) {
      return (
        <Button variant="outline" size="lg" className="w-full" disabled={isCurrent}>
          {isCurrent ? "Your current plan" : "Get started free"}
        </Button>
      );
    }
    if (isCurrent) {
      return (
        <Button variant="outline" size="lg" className="w-full" disabled>
          Your current plan
        </Button>
      );
    }
    return (
      <Button
        size="lg"
        className="w-full"
        disabled={isPending}
        onClick={() => onCheckout(plan.id as PaidPlanId)}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Redirecting…
          </>
        ) : (
          `Choose ${plan.name}`
        )}
      </Button>
    );
  })();

  return (
    <Card
      className={cn(
        "flex flex-col",
        plan.highlighted &&
          "ring-2 ring-primary shadow-lg shadow-primary/10",
      )}
    >
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-base font-semibold leading-none">
            {plan.name}
          </span>
          <div className="flex shrink-0 gap-1.5">
            {isCurrent && (
              <Badge variant="secondary" className="text-xs">
                Current plan
              </Badge>
            )}
            {plan.highlighted && !isCurrent && (
              <Badge className="text-xs">Most popular</Badge>
            )}
          </div>
        </div>

        {hasActiveDiscount && discount?.label && (
          <Badge className="mt-2 text-xs bg-amber-500/15 text-amber-400 border-amber-500/20 w-fit">
            {discount.label}
          </Badge>
        )}

        <div className="mt-2">
          {price !== null ? (
            <>
              {hasActiveDiscount && basePrice !== null && (
                <span className="text-base text-muted-foreground line-through mr-2">
                  ${basePrice}
                </span>
              )}
              <span className={cn("text-3xl font-bold", hasActiveDiscount && "text-primary")}>
                ${Math.round(price * 100) / 100}
              </span>
              <span className="text-muted-foreground text-sm"> /mo</span>
              {hasActiveDiscount && discount && (
                <span className="ml-2 text-xs font-medium text-amber-400">
                  {discount.type === "percentage"
                    ? `${discount.value}% off`
                    : `$${discount.value} off`}
                </span>
              )}
              {period === "yearly" && isPaid && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Billed annually
                </p>
              )}
            </>
          ) : (
            <span className="text-3xl font-bold">Free</span>
          )}
        </div>

        <p className="text-sm text-muted-foreground mt-2 leading-snug">
          {plan.description}
        </p>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 gap-4 pt-0">
        <ul className="space-y-2 flex-1">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <div className="space-y-1.5">
          {cta}
          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PricingContent({
  userId,
  currentPaidPlan,
}: {
  userId: string | null;
  currentPaidPlan: string | null;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  const visiblePlans = selectedPlanId
    ? PLANS.filter((p) => p.id === selectedPlanId)
    : PLANS;

  const selectedPlan = PLANS.find((p) => p.id === selectedPlanId) ?? null;

  function handleCheckout(planId: PaidPlanId) {
    setErrors({});
    setPendingPlan(planId);
    startTransition(async () => {
      try {
        const result = await createStripeCheckoutSessionAction({
          plan: planId,
          period,
        });
        window.location.href = result.url;
      } catch (e) {
        setErrors({
          [planId]: e instanceof Error ? e.message : "Unable to start checkout.",
        });
        setPendingPlan(null);
      }
    });
  }

  const isCurrentPlan = (planId: string) => {
    if (planId === "free") return currentPaidPlan === null;
    return currentPaidPlan === planId;
  };

  return (
    <div className="space-y-8">
      {/* Controls row: billing toggle + plan filter dropdown */}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        {/* Billing period toggle */}
        <div className="flex items-center gap-3">
          <Label
            htmlFor="billing-period"
            className={cn(
              "text-sm font-medium cursor-pointer",
              period === "monthly" ? "text-foreground" : "text-muted-foreground",
            )}
          >
            Monthly
          </Label>
          <Switch
            id="billing-period"
            checked={period === "yearly"}
            onCheckedChange={(checked) =>
              setPeriod(checked ? "yearly" : "monthly")
            }
          />
          <Label
            htmlFor="billing-period"
            className={cn(
              "text-sm font-medium cursor-pointer flex items-center gap-2",
              period === "yearly" ? "text-foreground" : "text-muted-foreground",
            )}
          >
            Annual
            <Badge
              variant="secondary"
              className="text-xs bg-green-500/15 text-green-400 border-green-500/20"
            >
              Save up to 20%
            </Badge>
          </Label>
        </div>

        {/* Plan filter dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-2 min-w-[9rem] justify-between",
            )}
          >
            <span className="flex items-center gap-2">
              <LayoutGrid className="size-3.5 shrink-0" />
              {selectedPlan ? selectedPlan.name : "All Plans"}
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={() => setSelectedPlanId(null)}
              className={cn("gap-2", !selectedPlanId && "font-medium text-primary")}
            >
              <LayoutGrid className="size-3.5" />
              All Plans
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {PLANS.map((plan) => (
              <DropdownMenuItem
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={cn(
                  "gap-2",
                  selectedPlanId === plan.id && "font-medium text-primary",
                )}
              >
                {plan.name}
                {plan.discount?.active && plan.discount.value > 0 && (
                  <Badge className="ml-auto text-[10px] px-1 py-0 bg-amber-500/15 text-amber-400 border-amber-500/20">
                    {plan.discount.type === "percentage"
                      ? `${plan.discount.value}%`
                      : `$${plan.discount.value}`}{" "}
                    off
                  </Badge>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Plan cards grid */}
      <div
        className={cn(
          "grid gap-4",
          visiblePlans.length === 1
            ? "max-w-sm mx-auto"
            : "sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {visiblePlans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            period={period}
            isCurrent={isCurrentPlan(plan.id)}
            userId={userId}
            isPending={pendingPlan === plan.id}
            error={errors[plan.id] ?? null}
            onCheckout={handleCheckout}
          />
        ))}
      </div>
    </div>
  );
}
