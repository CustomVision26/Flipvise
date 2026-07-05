"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PricingBillingPeriodToggle } from "@/components/pricing-billing-period-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { isGeneralDiscountEffectivelyActive } from "@/lib/plan-promo-window";
import {
  canUserStartPlanTrial,
  isPublishedPlanTrial,
  publishedTrialDaysForPlan,
} from "@/lib/plan-trial";
import {
  computePlanPeriodPricing,
  formatPlanMoney,
} from "@/lib/pricing-period-display";
import type { PricingBillingPeriod } from "@/lib/pricing-billing-period";
import type { StripePaidPlanId } from "@/lib/billing-plan-ids";
import {
  EDUCATION_PLAN_BADGES,
  EDUCATION_PLAN_LABELS,
  isEducationPlanId,
} from "@/lib/education-plans";
import type {
  PlanAffiliateDiscount,
  PlanConfig,
  PlanDiscount,
} from "@/lib/plan-config-types";
import plansConfigData from "@/data/plans-config.json";

type PaidPlanId = StripePaidPlanId;
type BillingPeriod = PricingBillingPeriod;
type AnyPlanId = "free" | PaidPlanId;

export type { PlanAffiliateDiscount, PlanConfig, PlanDiscount };
export { applyDiscount } from "@/lib/plan-pricing";
export { computePlanPeriodPricing, formatPlanMoney } from "@/lib/pricing-period-display";

const PLANS: PlanConfig[] = plansConfigData as PlanConfig[];

function PlanCard({
  plan,
  period,
  isCurrent,
  userId,
  error,
  hasUsedTrial,
  hasActiveSubscription,
  onCheckout,
  onTrialCheckout,
}: {
  plan: PlanConfig;
  period: BillingPeriod;
  isCurrent: boolean;
  userId: string | null;
  error: string | null;
  hasUsedTrial: boolean;
  hasActiveSubscription: boolean;
  onCheckout: (planId: PaidPlanId) => void;
  onTrialCheckout: (planId: PaidPlanId) => void;
}) {
  const periodPricing = computePlanPeriodPricing(plan, period);
  const discount = plan.discount;
  const hasActiveDiscount = periodPricing?.hasActiveDiscount ?? false;
  const isFree = plan.id === "free";
  const isEducation = isEducationPlanId(plan.id);
  const educationBadge = isEducation
    ? EDUCATION_PLAN_BADGES[plan.id as keyof typeof EDUCATION_PLAN_BADGES]
    : null;

  const trialEligible =
    userId != null &&
    !isFree &&
    canUserStartPlanTrial({
      plan,
      hasUsedTrial,
      hasActiveSubscription,
    }) &&
    period === "monthly";
  const trialDays = publishedTrialDaysForPlan(plan);

  const checkoutButtonLabel = (() => {
    if (isEducation) {
      return `Change to ${EDUCATION_PLAN_LABELS[plan.id as keyof typeof EDUCATION_PLAN_LABELS]}`;
    }
    if (trialEligible) return `Subscribe to ${plan.name} now`;
    if (userId && !isCurrent && !isFree) return `Change to ${plan.name}`;
    return `Choose ${plan.name}`;
  })();

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
      <div className="flex flex-col gap-2 w-full">
        {trialEligible ? (
          <Button
            size="lg"
            className="w-full"
            onClick={() => onTrialCheckout(plan.id as PaidPlanId)}
          >
            Start {trialDays}-day free trial
          </Button>
        ) : null}
        <Button
          size="lg"
          className="w-full"
          variant={trialEligible ? "outline" : "default"}
          onClick={() => onCheckout(plan.id as PaidPlanId)}
        >
          {checkoutButtonLabel}
        </Button>
      </div>
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
            {educationBadge && !isCurrent ? (
              <Badge variant="secondary" className="text-xs">
                {educationBadge}
              </Badge>
            ) : null}
            {isPublishedPlanTrial(plan) && trialEligible ? (
              <Badge variant="secondary" className="text-xs">
                {trialDays}-day trial
              </Badge>
            ) : null}
          </div>
        </div>

        {hasActiveDiscount && discount?.label && (
          <div className="mt-2 space-y-1">
            <Badge className="text-xs bg-amber-500/15 text-amber-400 border-amber-500/20 w-fit">
              {discount.label}
            </Badge>
            {discount.stripeCouponId?.trim() ? (
              <p className="text-xs text-muted-foreground">
                Promo code:{" "}
                <span className="font-mono font-medium text-foreground">
                  {discount.stripeCouponId.trim()}
                </span>
              </p>
            ) : null}
          </div>
        )}

        <div className="mt-2">
          {periodPricing ? (
            period === "yearly" && periodPricing.discountedAnnualTotal != null ? (
              <>
                {hasActiveDiscount && periodPricing.baseAnnualTotal != null && (
                  <span className="text-base text-muted-foreground line-through mr-2">
                    ${formatPlanMoney(periodPricing.baseAnnualTotal)}
                  </span>
                )}
                <span
                  className={cn(
                    "text-3xl font-bold",
                    hasActiveDiscount && "text-primary",
                  )}
                >
                  ${formatPlanMoney(periodPricing.discountedAnnualTotal)}
                </span>
                <span className="text-muted-foreground text-sm"> /yr</span>
                {hasActiveDiscount && discount && (
                  <span className="ml-2 text-xs font-medium text-amber-400">
                    {discount.type === "percentage"
                      ? `${discount.value}% off`
                      : `$${discount.value} off`}
                  </span>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  ${formatPlanMoney(periodPricing.discountedPeriodicRate)} /mo when billed
                  annually
                </p>
              </>
            ) : (
              <>
                {hasActiveDiscount && (
                  <span className="text-base text-muted-foreground line-through mr-2">
                    ${formatPlanMoney(periodPricing.basePeriodicRate)}
                  </span>
                )}
                <span
                  className={cn(
                    "text-3xl font-bold",
                    hasActiveDiscount && "text-primary",
                  )}
                >
                  ${formatPlanMoney(periodPricing.discountedPeriodicRate)}
                </span>
                <span className="text-muted-foreground text-sm"> /mo</span>
                {hasActiveDiscount && discount && (
                  <span className="ml-2 text-xs font-medium text-amber-400">
                    {discount.type === "percentage"
                      ? `${discount.value}% off`
                      : `$${discount.value} off`}
                  </span>
                )}
              </>
            )
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

function activePublicPromoCodes(plans: PlanConfig[]): Array<{ planName: string; code: string }> {
  const seen = new Set<string>();
  const rows: Array<{ planName: string; code: string }> = [];
  for (const plan of plans) {
    if (!isGeneralDiscountEffectivelyActive(plan)) continue;
    const code = plan.discount?.stripeCouponId?.trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    rows.push({ planName: plan.name, code });
  }
  return rows;
}

export function PricingContent({
  userId,
  currentPlanHighlightId,
  plans = PLANS,
  initialPromotionCode = "",
  hasUsedTrial = false,
  hasActiveSubscription = false,
}: {
  userId: string | null;
  /**
   * Which tier shows “Current plan”. `null` = visitor or no badge (e.g. admin unlock).
   * `"free"` = authenticated free tier.
   */
  currentPlanHighlightId: "free" | PaidPlanId | null;
  /** Optional — defaults to static JSON; `/pricing` passes Stripe-synced rows. */
  plans?: PlanConfig[];
  /** Prefill from `/pricing?promo=…` (affiliate or campaign links). */
  initialPromotionCode?: string;
  hasUsedTrial?: boolean;
  hasActiveSubscription?: boolean;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [promotionCode, setPromotionCode] = useState(initialPromotionCode.trim());
  const router = useRouter();
  const promoSectionRef = useRef<HTMLDivElement>(null);

  const publicPromoCodes = activePublicPromoCodes(plans);

  const visiblePlans = selectedPlanId
    ? plans.filter((p) => p.id === selectedPlanId)
    : plans;

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;

  function handleCheckout(planId: PaidPlanId, startTrial = false) {
    setErrors({});
    const params = new URLSearchParams({
      plan: planId,
      period,
    });
    if (!startTrial && promotionCode.trim()) {
      params.set("promo", promotionCode.trim());
    }
    if (startTrial) {
      params.set("trial", "1");
    }
    router.push(`/pricing/checkout?${params.toString()}`);
  }

  const isCurrentPlan = (planId: string) => {
    if (currentPlanHighlightId === null) return false;
    if (planId === "free") return currentPlanHighlightId === "free";
    return currentPlanHighlightId === planId;
  };

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-xl border border-border/80 bg-card/40">
        <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Billing period
            </span>
            <PricingBillingPeriodToggle
              period={period}
              onPeriodChange={setPeriod}
            />
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

      </div>

      <div
        ref={promoSectionRef}
        className="rounded-xl border border-border/80 bg-card/50 px-4 py-4 sm:px-5"
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="checkout-promo" className="text-sm font-medium text-foreground">
              Promotion code
            </Label>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Optional. Enter a public promo or combined affiliate code before you choose a plan.
            </p>
          </div>
          <Input
            id="checkout-promo"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="e.g. SUMMER26 or SummerLaunchusera1276"
            value={promotionCode}
            onChange={(e) => setPromotionCode(e.target.value)}
            className="h-10 max-w-md bg-background/80 text-sm font-mono"
          />
          {publicPromoCodes.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="shrink-0">Active codes:</span>
              {publicPromoCodes.map(({ code }) => (
                <Button
                  key={code}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 px-2 font-mono text-xs"
                  onClick={() => setPromotionCode(code)}
                >
                  <span className="font-sans text-muted-foreground">Promo</span>
                  {code}
                </Button>
              ))}
            </div>
          ) : null}
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
            General codes apply to the matching tier. Affiliate codes combine the tier&apos;s base
            promo with an affiliate ID (shown on each plan card when a sale is running). Each promo
            can only be used once per account. Plan upgrades and downgrades use Stripe proration
            without an additional promo. Sign in before checkout if you have not already.
          </p>
        </div>
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
            error={errors[plan.id] ?? null}
            hasUsedTrial={hasUsedTrial}
            hasActiveSubscription={hasActiveSubscription}
            onCheckout={(planId) => handleCheckout(planId, false)}
            onTrialCheckout={(planId) => handleCheckout(planId, true)}
          />
        ))}
      </div>
    </div>
  );
}
