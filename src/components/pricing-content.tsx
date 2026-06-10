"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Loader2, ChevronDown, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { createStripeCheckoutSessionAction } from "@/actions/stripe";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { StripePaidPlanId } from "@/lib/billing-plan-ids";
import plansConfigData from "@/data/plans-config.json";

type PaidPlanId = StripePaidPlanId;
type BillingPeriod = "monthly" | "yearly";
type AnyPlanId = "free" | PaidPlanId;

export type PlanDiscount = {
  active: boolean;
  type: "percentage" | "fixed";
  value: number;
  label: string;
  stripeCouponId: string;
};

/** Separate from the public “general” discount — used with combined Stripe coupon + affiliate promotional code at checkout. */
export type PlanAffiliateDiscount = {
  active: boolean;
  /** Percentage off subscription when checkout uses the combined code. */
  value: number;
  /** Optional label for admin UI only. */
  label?: string;
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
  affiliateDiscount?: PlanAffiliateDiscount;
  /** ISO date string (YYYY-MM-DD) — when set, marks the date this plan will be discontinued. */
  discontinueAt?: string | null;
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
        "flex flex-col border-border/80 bg-card/60 shadow-sm",
        plan.highlighted && "border-primary/40 ring-1 ring-primary/20",
      )}
    >
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-base font-medium leading-none tracking-tight">
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
        <ul className="flex-1 space-y-2.5 border-t border-border/60 pt-4">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm leading-snug text-muted-foreground">
              <Check className="mt-0.5 size-3.5 shrink-0 text-primary/90" />
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
  currentPlanHighlightId,
  plans = PLANS,
}: {
  userId: string | null;
  /**
   * Which tier shows “Current plan”. `null` = visitor or no badge (e.g. admin unlock).
   * `"free"` = authenticated free tier.
   */
  currentPlanHighlightId: "free" | PaidPlanId | null;
  /** Optional — defaults to static JSON; `/pricing` passes Stripe-synced rows. */
  plans?: PlanConfig[];
}) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [promotionCode, setPromotionCode] = useState("");
  const [, startTransition] = useTransition();

  const visiblePlans = selectedPlanId
    ? plans.filter((p) => p.id === selectedPlanId)
    : plans;

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;

  function handleCheckout(planId: PaidPlanId) {
    setErrors({});
    setPendingPlan(planId);
    startTransition(async () => {
      try {
        const result = await createStripeCheckoutSessionAction({
          plan: planId,
          period,
          ...(promotionCode.trim()
            ? { promotionCode: promotionCode.trim() }
            : {}),
        });
        if (result.upgradedInPlace) {
          toast.success("Plan updated", {
            description:
              "Your subscription was changed in place. Stripe may email a proration receipt for the difference.",
            duration: 10_000,
          });
        }
        window.location.href = result.url;
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Unable to start checkout.";
        toast.error("Could not start checkout", {
          description: message,
          duration: 12_000,
        });
        setPendingPlan(null);
      }
    });
  }

  const isCurrentPlan = (planId: string) => {
    if (currentPlanHighlightId === null) return false;
    if (planId === "free") return currentPlanHighlightId === "free";
    return currentPlanHighlightId === planId;
  };

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-xl border border-border/80 bg-card/40">
        <div className="flex flex-col gap-4 border-b border-border/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Billing period
            </span>
            <div
              className="inline-flex rounded-lg border border-border/80 bg-muted/20 p-1"
              role="group"
              aria-label="Billing period"
            >
              <Button
                type="button"
                size="sm"
                variant={period === "monthly" ? "secondary" : "ghost"}
                className={cn(
                  "h-8 min-w-[5.5rem] rounded-md px-4 text-sm font-medium",
                  period === "monthly" && "shadow-sm",
                )}
                onClick={() => setPeriod("monthly")}
              >
                Monthly
              </Button>
              <Button
                type="button"
                size="sm"
                variant={period === "yearly" ? "secondary" : "ghost"}
                className={cn(
                  "h-8 min-w-[5.5rem] gap-2 rounded-md px-4 text-sm font-medium",
                  period === "yearly" && "shadow-sm",
                )}
                onClick={() => setPeriod("yearly")}
              >
                Annual
                <Badge
                  variant="outline"
                  className="border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0 text-[10px] font-medium text-emerald-300"
                >
                  Save
                </Badge>
              </Button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 sm:items-end">
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              View plans
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-8 min-w-[10rem] justify-between gap-2 bg-background/60 px-3",
                )}
              >
                <span className="flex items-center gap-2 truncate">
                  <SlidersHorizontal className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {selectedPlan ? selectedPlan.name : "All plans"}
                  </span>
                </span>
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => setSelectedPlanId(null)}
                  className={cn(!selectedPlanId && "font-medium text-primary")}
                >
                  All plans
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {plans.map((plan) => (
                  <DropdownMenuItem
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={cn(
                      "justify-between gap-2",
                      selectedPlanId === plan.id && "font-medium text-primary",
                    )}
                  >
                    <span>{plan.name}</span>
                    {plan.discount?.active && plan.discount.value > 0 ? (
                      <Badge className="shrink-0 border-amber-500/20 bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-300">
                        {plan.discount.type === "percentage"
                          ? `${plan.discount.value}%`
                          : `$${plan.discount.value}`}
                      </Badge>
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {userId ? (
          <div className="space-y-3 px-4 py-4 sm:px-5">
            <div className="space-y-1">
              <Label htmlFor="checkout-promo" className="text-sm font-medium text-foreground">
                Promotion code
              </Label>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Optional. Apply a public promo or affiliate code at checkout.
              </p>
            </div>
            <Input
              id="checkout-promo"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Enter your code"
              value={promotionCode}
              onChange={(e) => setPromotionCode(e.target.value)}
              className="h-10 max-w-md bg-background/80 text-sm"
            />
            <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
              Use the code listed for your selected tier, or a combined affiliate code made from
              the tier&apos;s base promo plus your affiliate ID. The discount matches the plan you
              choose at checkout.
            </p>
          </div>
        ) : null}
      </div>

      {/* Plan cards grid */}
      <div
        className={cn(
          "grid gap-5",
          visiblePlans.length === 1
            ? "mx-auto max-w-sm"
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
