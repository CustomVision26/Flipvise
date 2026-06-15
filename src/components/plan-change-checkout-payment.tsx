"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CreditCard } from "lucide-react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SlideToSubmitButton } from "@/components/slide-to-submit-button";
import { formatCentsMoney } from "@/lib/money-math";
import type {
  PlanChangeCheckoutContext,
  PlanChangeProrationPreview,
} from "@/lib/plan-change-proration-preview";
import { getStripePromise } from "@/lib/stripe-load-client";
import {
  STRIPE_CHECKOUT_ELEMENTS_APPEARANCE,
  STRIPE_CHECKOUT_NAVY,
  STRIPE_CHECKOUT_PAGE_BG,
  STRIPE_CHECKOUT_TEXT,
  isStripeTestModeClient,
} from "@/lib/stripe-checkout-appearance";
import type { PricingBillingPeriod } from "@/lib/pricing-billing-period";
import { cn } from "@/lib/utils";

export type PlanChangeCheckoutSummary = {
  context: PlanChangeCheckoutContext;
  period: PricingBillingPeriod;
  customerEmail: string | null;
  preview: PlanChangeProrationPreview;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#6b7280]">
      {children}
    </p>
  );
}

function PlanChangeOrderSummary({ summary }: { summary: PlanChangeCheckoutSummary }) {
  const { context, preview, period } = summary;
  const periodLabel = period === "yearly" ? "Annual billing" : "Monthly billing";

  return (
    <section className="space-y-4">
      <SectionLabel>Plan change summary</SectionLabel>
      <div className="space-y-1">
        <h1
          className="font-serif text-xl font-normal tracking-tight text-[#1a2332] sm:text-[1.35rem]"
          style={{ fontFamily: 'Georgia, "Noto Serif", serif' }}
        >
          Change to {context.targetPlanLabel}
        </h1>
        <p className="text-sm text-[#6b7280]">
          {context.currentPlanLabel} → {context.targetPlanLabel} · {periodLabel}
        </p>
      </div>

      <Badge
        variant="outline"
        className="border-sky-300/50 bg-sky-50 font-normal text-sky-950"
      >
        Prorated adjustment — no additional promo discount
      </Badge>

      <div className="space-y-2 rounded-md border border-[#e8ebf0] bg-[#fafbfc] px-4 py-3.5 text-sm">
        {preview.lines.length > 0 ? (
          <ul className="space-y-2.5">
            {preview.lines.map((line, index) => (
              <li
                key={`${line.description}-${index}`}
                className="flex items-start justify-between gap-4"
              >
                <span className="min-w-0 text-[#6b7280] leading-snug">
                  {line.description}
                </span>
                <span
                  className={cn(
                    "shrink-0 tabular-nums text-[#30313d]",
                    line.amountCents < 0 && "text-emerald-800",
                  )}
                >
                  {line.amountCents < 0 ? "−" : ""}
                  {formatCentsMoney(
                    Math.abs(line.amountCents),
                    preview.currency,
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[#6b7280]">No line-item breakdown available.</p>
        )}

        <Separator className="bg-[#e0e4e8]" />

        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="font-medium text-[#1a2332]">Estimated due today</span>
          <span className="font-serif text-2xl font-semibold tabular-nums text-[#1a2332]">
            {formatCentsMoney(preview.amountDueCents, preview.currency)}
          </span>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-[#6b7280]">
        Amounts are estimated from your current billing period. Each line is prorated for
        unused or remaining time in this cycle only — not the full list price for a new
        billing period; renewal after this period is at the plan&apos;s standard rate.
        Previous promotion discounts do not apply to this plan change. Your payment method
        below will be charged or credited when you confirm.
      </p>
    </section>
  );
}

function PlanChangePaymentForm({
  summary,
  returnUrl,
}: {
  summary: PlanChangeCheckoutSummary;
  returnUrl: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalLabel = formatCentsMoney(
    summary.preview.amountDueCents,
    summary.preview.currency,
  );
  const slideLabel = `Slide to confirm plan change — ${totalLabel}`;

  async function handleConfirm() {
    if (!stripe || !elements) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: returnUrl,
      },
    });

    if (result.error) {
      setErrorMessage(result.error.message ?? "Unable to confirm payment method.");
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <PlanChangeOrderSummary summary={summary} />
      <Separator className="bg-[#e8ebf0]" />

      <section className="space-y-5">
        <SectionLabel>Payment details</SectionLabel>

        {summary.customerEmail ? (
          <div className="space-y-2">
            <Label
              htmlFor="plan-change-email"
              className="text-sm font-medium text-[#30313d]"
            >
              Email
            </Label>
            <Input
              id="plan-change-email"
              readOnly
              value={summary.customerEmail}
              className="h-11 border-[#d0d7e2] bg-white font-normal text-[#30313d] shadow-none"
            />
          </div>
        ) : null}

        <div className="space-y-3">
          <p className="text-sm font-medium text-[#30313d]">Payment method</p>
          <div className="flex items-center gap-2 rounded-md border border-[#e8ebf0] bg-[#fafbfc] px-3 py-2 text-sm text-[#30313d]">
            <CreditCard className="size-4 text-[#6b7280]" aria-hidden />
            <span>Card</span>
          </div>
          <PaymentElement />
        </div>

        {errorMessage ? (
          <p
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}

        <div className="space-y-3 pt-1">
          <p className="text-center text-xs font-medium uppercase tracking-[0.12em] text-[#6b7280]">
            Confirm plan change
          </p>
          <SlideToSubmitButton
            label={slideLabel}
            disabled={!stripe || !elements || isSubmitting}
            pending={isSubmitting}
            onSubmit={handleConfirm}
            variant="checkout"
          />
          <p className="text-center text-xs leading-relaxed text-[#6b7280]">
            By confirming, you authorize Flipvise to adjust your subscription and
            charge or credit your payment method according to the summary above.
          </p>
        </div>
      </section>
    </>
  );
}

export function PlanChangeCheckoutPayment({
  clientSecret,
  returnUrl,
  summary,
  backHref,
}: {
  clientSecret: string;
  returnUrl: string;
  summary: PlanChangeCheckoutSummary;
  backHref: string;
}) {
  const stripePromise = useMemo(() => getStripePromise(), []);
  const isTestMode = isStripeTestModeClient();
  const options = useMemo(
    () => ({
      clientSecret,
      appearance: STRIPE_CHECKOUT_ELEMENTS_APPEARANCE,
    }),
    [clientSecret],
  );

  return (
    <div
      className="min-h-[calc(100vh-4rem)] py-8 sm:py-12"
      style={{ backgroundColor: STRIPE_CHECKOUT_PAGE_BG, color: STRIPE_CHECKOUT_TEXT }}
    >
      <div className="mx-auto w-full max-w-[520px] px-4 sm:px-6">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Link
              href={backHref}
              className="inline-flex size-9 items-center justify-center rounded-md border border-[#d8dee6] bg-white text-[#30313d] shadow-sm hover:bg-[#fafbfc]"
              aria-label="Back"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt=""
                width={28}
                height={28}
                className="size-7 rounded-sm"
              />
              <span
                className="text-base font-medium text-[#1a2332]"
                style={{ fontFamily: 'Georgia, "Noto Serif", serif' }}
              >
                Flipvise
              </span>
              {isTestMode ? (
                <Badge
                  className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white hover:opacity-90"
                  style={{ backgroundColor: STRIPE_CHECKOUT_NAVY }}
                >
                  Sandbox
                </Badge>
              ) : null}
            </div>
          </div>
        </header>

        <div className="overflow-hidden rounded-lg border border-[#d8dee6] bg-white shadow-[0_8px_30px_rgba(26,35,50,0.06)]">
          <div className="border-b border-[#e8ebf0] bg-[#fafbfc] px-5 py-4 sm:px-7">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#6b7280]">
              Secure checkout
            </p>
          </div>

          <div className="space-y-8 px-5 py-6 sm:px-7 sm:py-8">
            <Elements stripe={stripePromise} options={options}>
              <PlanChangePaymentForm summary={summary} returnUrl={returnUrl} />
            </Elements>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-[#6b7280]">
          Powered by{" "}
          <span className="font-semibold tracking-tight text-[#635bff]">stripe</span>
        </p>
      </div>
    </div>
  );
}
