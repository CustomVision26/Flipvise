"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { createStripeCheckoutSessionAction } from "@/actions/stripe";
import {
  getPlanChangeProrationPreviewAction,
  validatePlanChangeTargetPriceAction,
  type PlanChangeCheckoutContextResult,
} from "@/actions/plan-change-checkout";
import { SlideToSubmitButton } from "@/components/slide-to-submit-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publishedTrialDaysForPlan } from "@/lib/plan-trial";
import { PricingBillingPeriodToggle } from "@/components/pricing-billing-period-toggle";
import { type PlanConfig } from "@/lib/plan-config-types";
import {
  checkoutErrorUserMessage,
  checkoutPlanChangeNoPromoError,
  shouldClearPromoOnCheckoutError,
} from "@/lib/checkout-promo-errors";
import {
  computePlanPeriodPricing,
  formatPlanMoney,
} from "@/lib/pricing-period-display";
import type { PricingBillingPeriod } from "@/lib/pricing-billing-period";
import { formatCentsMoney } from "@/lib/money-math";
import { navigateAfterCheckoutSessionCreated } from "@/lib/navigate-checkout-session";
import type { StripePaidPlanId } from "@/lib/billing-plan-ids";
import { cn } from "@/lib/utils";

export function PricingCheckoutStep({
  planId,
  plan,
  initialPeriod,
  initialPromotionCode,
  checkoutCanceled,
  planChangeContext,
  startTrial = false,
}: {
  planId: StripePaidPlanId;
  plan: PlanConfig;
  initialPeriod: PricingBillingPeriod;
  initialPromotionCode: string;
  checkoutCanceled: boolean;
  planChangeContext: PlanChangeCheckoutContextResult | null;
  startTrial?: boolean;
}) {
  const isPlanChange = planChangeContext != null;
  const [period, setPeriod] = useState<PricingBillingPeriod>(initialPeriod);
  const [promotionCode, setPromotionCode] = useState(initialPromotionCode.trim());
  const [prorationPreview, setProrationPreview] = useState(
    planChangeContext?.initialPreview ?? null,
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [trialAcknowledged, setTrialAcknowledged] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const pricing = computePlanPeriodPricing(plan, period);
  const trialDays = startTrial ? publishedTrialDaysForPlan(plan) : 0;

  useEffect(() => {
    if (startTrial && period !== "monthly") {
      setPeriod("monthly");
    }
  }, [startTrial, period]);

  useEffect(() => {
    if (!isPlanChange) return;
    let cancelled = false;
    setPreviewLoading(true);
    getPlanChangeProrationPreviewAction({ plan: planId, period })
      .then((preview) => {
        if (!cancelled) setProrationPreview(preview);
      })
      .catch(() => {
        if (!cancelled) setProrationPreview(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isPlanChange, planId, period]);

  function handleCheckoutError(e: unknown) {
    const rawMessage =
      e instanceof Error ? e.message : "Unable to start checkout.";
    const message = checkoutErrorUserMessage(rawMessage);
    if (shouldClearPromoOnCheckoutError(rawMessage)) {
      setPromotionCode("");
    }
    toast.error(isPlanChange ? "Could not confirm plan change" : "Could not start checkout", {
      description: message,
      duration: 14_000,
    });
  }

  function continueToStripe() {
    if (isPlanChange && promotionCode.trim()) {
      handleCheckoutError(checkoutPlanChangeNoPromoError());
      return;
    }

    startTransition(async () => {
      try {
        if (isPlanChange) {
          await validatePlanChangeTargetPriceAction({ plan: planId, period });
          const params = new URLSearchParams({ plan: planId, period });
          router.push(`/pricing/checkout/plan-change/pay?${params.toString()}`);
          return;
        }

        const result = await createStripeCheckoutSessionAction({
          plan: planId,
          period,
          ...(!startTrial && promotionCode.trim()
            ? { promotionCode: promotionCode.trim() }
            : {}),
          ...(startTrial ? { startTrial: true } : {}),
        });
        navigateAfterCheckoutSessionCreated(result, router.push);
      } catch (e) {
        handleCheckoutError(e);
      }
    });
  }

  const slideLabel = isPlanChange
    ? `Slide to confirm — ${period === "yearly" ? "Yearly" : "Monthly"}`
    : startTrial
      ? `Slide to start free trial — Monthly`
      : `Slide to continue — ${period === "yearly" ? "Yearly" : "Monthly"}`;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <Link
        href="/pricing"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "w-fit gap-1.5 text-muted-foreground hover:text-foreground",
        )}
      >
        <ArrowLeft className="size-3.5" />
        Back to plans
      </Link>

      <Card className="border-border/80 bg-card/60">
        <CardHeader className="space-y-4">
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {isPlanChange ? "Plan change" : "Checkout"}
            </p>
            <CardTitle className="text-xl">{plan.name}</CardTitle>
          </div>

          {isPlanChange && planChangeContext ? (
            <div className="space-y-3 rounded-lg border border-sky-500/25 bg-sky-500/5 px-4 py-3 text-sm">
              <p className="text-foreground">
                Changing from{" "}
                <span className="font-medium">{planChangeContext.currentPlanLabel}</span>
                {" → "}
                <span className="font-medium">{planChangeContext.targetPlanLabel}</span>
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Your existing subscription will be adjusted on a prorated basis. You may
                receive a credit for unused time on your current plan and be charged for the
                new plan for the remainder of the billing period. Each line reflects only
                the unused or remaining time in this cycle — not the full monthly or annual
                list price. Confirm below to apply this change; your saved payment method
                will be charged or credited accordingly.
              </p>
              {previewLoading ? (
                <p className="text-xs text-muted-foreground">Calculating proration…</p>
              ) : prorationPreview ? (
                <div className="space-y-1 border-t border-border/60 pt-3 text-sm">
                  <p className="font-medium text-foreground">
                    Estimated due today:{" "}
                    <span className="tabular-nums">
                      {formatCentsMoney(
                        prorationPreview.amountDueCents,
                        prorationPreview.currency,
                      )}
                    </span>
                  </p>
                  {prorationPreview.creditCents != null ? (
                    <p className="text-xs text-muted-foreground">
                      Includes credit:{" "}
                      {formatCentsMoney(
                        prorationPreview.creditCents,
                        prorationPreview.currency,
                      )}
                    </p>
                  ) : null}
                  {prorationPreview.chargeCents != null ? (
                    <p className="text-xs text-muted-foreground">
                      Includes new plan charge:{" "}
                      {formatCentsMoney(
                        prorationPreview.chargeCents,
                        prorationPreview.currency,
                      )}
                    </p>
                  ) : null}
                </div>
              ) : !previewLoading ? (
                <p className="text-xs text-amber-400/90">
                  We couldn&apos;t calculate proration right now. You can still continue — if
                  checkout fails, contact support and we&apos;ll help you switch plans.
                </p>
              ) : null}
            </div>
          ) : null}

          {!startTrial ? (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Billing period</Label>
              <PricingBillingPeriodToggle
                period={period}
                onPeriodChange={setPeriod}
                className="w-full sm:w-auto"
              />
            </div>
          ) : null}

          {!isPlanChange && pricing ? (
            <div className="rounded-lg border border-border/70 bg-background/40 px-4 py-3">
              {startTrial && trialDays > 0 ? (
                <>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-3xl font-bold tabular-nums">$0</span>
                    <span className="text-sm text-muted-foreground">
                      for {trialDays} days
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Then ${formatPlanMoney(pricing.basePeriodicRate)} / month
                  </p>
                </>
              ) : pricing.hasActiveDiscount && plan.discount?.label ? (
                <Badge className="mb-2 text-xs bg-amber-500/15 text-amber-400 border-amber-500/20">
                  {plan.discount.label}
                </Badge>
              ) : null}
              {!startTrial && period === "yearly" && pricing.discountedAnnualTotal != null ? (
                <>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    {pricing.hasActiveDiscount && pricing.baseAnnualTotal != null ? (
                      <span className="text-base text-muted-foreground line-through">
                        ${formatPlanMoney(pricing.baseAnnualTotal)}
                      </span>
                    ) : null}
                    <span className="text-3xl font-bold tabular-nums">
                      ${formatPlanMoney(pricing.discountedAnnualTotal)}
                    </span>
                    <span className="text-sm text-muted-foreground">/ year</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    ${formatPlanMoney(pricing.discountedPeriodicRate)} / month when billed
                    annually
                  </p>
                </>
              ) : !startTrial ? (
                <>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    {pricing.hasActiveDiscount ? (
                      <span className="text-base text-muted-foreground line-through">
                        ${formatPlanMoney(pricing.basePeriodicRate)}
                      </span>
                    ) : null}
                    <span className="text-3xl font-bold tabular-nums">
                      ${formatPlanMoney(pricing.discountedPeriodicRate)}
                    </span>
                    <span className="text-sm text-muted-foreground">/ month</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Billed monthly</p>
                </>
              ) : null}
            </div>
          ) : null}

          {isPlanChange && pricing ? (
            <div className="rounded-lg border border-border/70 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
              New recurring rate:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {period === "yearly" && pricing.discountedAnnualTotal != null
                  ? `$${formatPlanMoney(pricing.discountedAnnualTotal)} / year`
                  : `$${formatPlanMoney(pricing.discountedPeriodicRate)} / month`}
              </span>
              <span className="block mt-1 text-xs">
                List price shown — your first invoice uses proration, not a new promo discount.
              </span>
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-4">
          {checkoutCanceled ? (
            <p className="text-sm text-muted-foreground">
              Checkout was canceled. Choose monthly or yearly, then continue when you are
              ready.
            </p>
          ) : null}

          {isPlanChange ? (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              Promotion codes cannot be applied when changing plans. If you already used a
              campaign discount on your current subscription, it cannot be applied again on
              upgrade or downgrade.
            </div>
          ) : startTrial && trialDays > 0 && pricing ? (
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-sm leading-relaxed">
              <p className="font-medium text-foreground">
                Full {plan.name} access for {trialDays} days — no charge today
              </p>
              <p className="mt-2 text-muted-foreground">
                {plan.description
                  ? `${plan.description.charAt(0).toUpperCase()}${plan.description.slice(1)}`
                  : `Everything included in ${plan.name} is unlocked during your trial.`}
                {" "}You will add a payment method on the next screen; you will not be charged
                until the trial ends.
              </p>
              <p className="mt-2 text-muted-foreground">
                When your {trialDays}-day trial ends, your subscription continues at $
                {formatPlanMoney(pricing.basePeriodicRate)}/month. Cancel anytime before
                then from your account to avoid being charged.
              </p>
            </div>
          ) : !startTrial ? (
            <div className="space-y-2">
              <Label htmlFor="checkout-step-promo">Promotion code</Label>
              <Input
                id="checkout-step-promo"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Optional"
                value={promotionCode}
                onChange={(e) => setPromotionCode(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Each promo can only be used once per account. Plan changes are prorated
                without an additional promo.
              </p>
            </div>
          ) : null}

          {startTrial && trialDays > 0 && pricing ? (
            <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-background/40 px-3 py-3">
              <Checkbox
                id="checkout-trial-ack"
                checked={trialAcknowledged}
                onCheckedChange={(checked) => setTrialAcknowledged(checked === true)}
                className="mt-0.5"
              />
              <Label
                htmlFor="checkout-trial-ack"
                className="cursor-pointer text-sm font-normal leading-relaxed text-muted-foreground"
              >
                I understand that after my {trialDays}-day free trial, I will be charged $
                {formatPlanMoney(pricing.basePeriodicRate)}/month unless I cancel before
                the trial ends.
              </Label>
            </div>
          ) : null}

          <SlideToSubmitButton
            label={slideLabel}
            disabled={
              isPending ||
              (isPlanChange && previewLoading) ||
              (startTrial && !trialAcknowledged)
            }
            pending={isPending}
            onSubmit={continueToStripe}
          />
        </CardContent>
      </Card>
    </div>
  );
}
