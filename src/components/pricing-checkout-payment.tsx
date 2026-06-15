"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CreditCard, Tag } from "lucide-react";
import {
  BillingAddressElement,
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SlideToSubmitButton } from "@/components/slide-to-submit-button";
import type { CheckoutPromoDisplay } from "@/lib/checkout-promo-display-types";
import type { CheckoutSessionAmountsMajor } from "@/lib/stripe-checkout-session-amounts";
import {
  stripeCheckoutElementsTotalFormatted,
  stripeCheckoutElementsTotalMajor,
} from "@/lib/stripe-formatted-money";
import { getStripePromise } from "@/lib/stripe-load-client";
import {
  STRIPE_CHECKOUT_ELEMENTS_APPEARANCE,
  STRIPE_CHECKOUT_NAVY,
  STRIPE_CHECKOUT_PAGE_BG,
  STRIPE_CHECKOUT_TEXT,
  isStripeTestModeClient,
} from "@/lib/stripe-checkout-appearance";
import { formatPlanMoney } from "@/lib/pricing-period-display";
import type { PricingBillingPeriod } from "@/lib/pricing-billing-period";
import { cn } from "@/lib/utils";

export type PricingCheckoutSummary = {
  planLabel: string;
  period: PricingBillingPeriod;
  customerEmail: string | null;
  campaignLabel: string | null;
  promo: CheckoutPromoDisplay | null;
  /** Stripe Checkout Session amounts — same source as the slide button total. */
  stripeAmounts: CheckoutSessionAmountsMajor | null;
};

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#6b7280]">
      {children}
    </p>
  );
}

function PromoPanel({ promo }: { promo: CheckoutPromoDisplay }) {
  const isAffiliate = promo.kind === "affiliate";

  return (
    <div className="rounded-md border border-[#d8dee6] bg-[#f8f9fb] px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border",
            isAffiliate
              ? "border-violet-200 bg-violet-50 text-violet-800"
              : "border-amber-200 bg-amber-50 text-amber-900",
          )}
        >
          <Tag className="size-3.5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-medium text-[#1a2332]">
            {isAffiliate ? "Affiliate discount" : "General discount coupon"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-[#d0d7e2] bg-white px-2 py-0.5 font-mono text-sm font-medium text-[#1a2332]">
              {promo.code}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "text-[11px] font-medium",
                isAffiliate
                  ? "border-violet-300/60 bg-violet-50 text-violet-900"
                  : "border-amber-300/60 bg-amber-50 text-amber-950",
              )}
            >
              {promo.kindLabel}
            </Badge>
          </div>
          {promo.receiptLine ? (
            <p className="text-xs leading-relaxed text-[#6b7280]">
              Applied to this subscription: {promo.receiptLine}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function OrderSummary({
  summary,
  liveTotalMajor,
}: {
  summary: PricingCheckoutSummary;
  liveTotalMajor: number | null;
}) {
  const isYearly = summary.period === "yearly";
  const periodLabel = isYearly ? "Annual billing" : "Monthly billing";
  const amounts = summary.stripeAmounts;

  const subtotal = amounts?.subtotalMajor ?? null;
  const discount = amounts?.discountMajor ?? null;
  const totalDue =
    liveTotalMajor ?? amounts?.totalDueMajor ?? null;

  const impliedTax =
    totalDue != null && subtotal != null
      ? roundMoney(Math.max(0, totalDue - subtotal + (discount ?? 0)))
      : (amounts?.taxMajor ?? null);

  const monthlyEquivalent =
    isYearly && totalDue != null ? roundMoney(totalDue / 12) : null;

  return (
    <section className="space-y-4">
      <SectionLabel>Order summary</SectionLabel>
      <div className="space-y-1">
        <h1
          className="font-serif text-xl font-normal tracking-tight text-[#1a2332] sm:text-[1.35rem]"
          style={{ fontFamily: 'Georgia, "Noto Serif", serif' }}
        >
          Subscribe to {summary.planLabel}
        </h1>
        <p className="text-sm text-[#6b7280]">{periodLabel}</p>
      </div>

      {summary.campaignLabel ? (
        <Badge className="border-amber-300/50 bg-amber-50 font-normal text-amber-950 hover:bg-amber-50">
          {summary.campaignLabel}
        </Badge>
      ) : null}

      <div className="space-y-2 rounded-md border border-[#e8ebf0] bg-[#fafbfc] px-4 py-3.5 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[#6b7280]">
            {summary.planLabel} · {isYearly ? "Yearly" : "Monthly"}
          </span>
          {subtotal != null ? (
            <span
              className={cn(
                "tabular-nums text-[#30313d]",
                discount != null && discount > 0 && "text-[#6b7280] line-through",
              )}
            >
              ${formatPlanMoney(subtotal)}
            </span>
          ) : null}
        </div>
        {discount != null && discount > 0 ? (
          <div className="flex items-baseline justify-between gap-4 text-emerald-800">
            <span>
              {summary.promo?.kind === "affiliate"
                ? "Affiliate discount"
                : "General discount"}
            </span>
            <span className="tabular-nums">−${formatPlanMoney(discount)}</span>
          </div>
        ) : null}
        {impliedTax != null && impliedTax > 0 ? (
          <div className="flex items-baseline justify-between gap-4 text-[#30313d]">
            <span>Tax</span>
            <span className="tabular-nums">${formatPlanMoney(impliedTax)}</span>
          </div>
        ) : null}
        <Separator className="bg-[#e0e4e8]" />
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="font-medium text-[#1a2332]">Total due today</span>
          {totalDue != null ? (
            <div className="text-right">
              <span className="font-serif text-2xl font-semibold tabular-nums text-[#1a2332]">
                ${formatPlanMoney(totalDue)}
              </span>
              <span className="ml-1.5 text-sm text-[#6b7280]">
                {isYearly ? "per year" : "per month"}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {monthlyEquivalent != null ? (
        <p className="text-sm text-[#6b7280]">
          ${formatPlanMoney(monthlyEquivalent)} / month when billed annually
        </p>
      ) : null}

      {summary.promo ? <PromoPanel promo={summary.promo} /> : null}
    </section>
  );
}

function CheckoutPayBody({
  summary,
}: {
  summary: PricingCheckoutSummary;
}) {
  const checkoutState = useCheckoutElements();
  const liveTotalMajor =
    checkoutState.type !== "loading" && checkoutState.type !== "error"
      ? stripeCheckoutElementsTotalMajor(checkoutState.checkout.total)
      : null;

  return (
    <>
      <OrderSummary summary={summary} liveTotalMajor={liveTotalMajor} />
      <Separator className="bg-[#e8ebf0]" />
      <CheckoutPaymentFields
        customerEmail={summary.customerEmail}
        checkoutState={checkoutState}
      />
    </>
  );
}

function CheckoutPaymentFields({
  customerEmail,
  checkoutState,
}: {
  customerEmail: string | null;
  checkoutState: ReturnType<typeof useCheckoutElements>;
}) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (checkoutState.type === "loading") {
    return (
      <p className="text-sm text-[#6b7280]">Loading secure payment form…</p>
    );
  }

  if (checkoutState.type === "error") {
    return (
      <p className="text-sm text-destructive">
        {checkoutState.error.message || "Unable to load payment form."}
      </p>
    );
  }

  const { checkout } = checkoutState;
  const stripeTotal = stripeCheckoutElementsTotalFormatted(checkout.total);
  const slideLabel = stripeTotal
    ? `Slide to subscribe — ${stripeTotal}`
    : "Slide to subscribe";

  async function handleSubscribe() {
    setIsSubmitting(true);
    setErrorMessage(null);
    const result = await checkout.confirm();
    if (result.type === "error") {
      setErrorMessage(result.error.message);
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-5">
      <SectionLabel>Payment details</SectionLabel>

      {customerEmail ? (
        <div className="space-y-2">
          <Label htmlFor="checkout-email" className="text-sm font-medium text-[#30313d]">
            Email
          </Label>
          <Input
            id="checkout-email"
            readOnly
            value={customerEmail}
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

      <BillingAddressElement />

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
          Complete subscription
        </p>
        <SlideToSubmitButton
          label={slideLabel}
          disabled={!checkout.canConfirm || isSubmitting}
          pending={isSubmitting}
          onSubmit={handleSubscribe}
          variant="checkout"
        />
        <p className="text-center text-xs leading-relaxed text-[#6b7280]">
          By subscribing, you authorize Flipvise to charge you according to the terms until
          you cancel.
        </p>
      </div>
    </section>
  );
}

export function PricingCheckoutPayment({
  clientSecret,
  summary,
  backHref,
  className,
}: {
  clientSecret: string;
  summary: PricingCheckoutSummary;
  backHref: string;
  className?: string;
}) {
  const stripePromise = useMemo(() => getStripePromise(), []);
  const isTestMode = isStripeTestModeClient();
  const options = useMemo(
    () => ({
      clientSecret,
      elementsOptions: {
        appearance: STRIPE_CHECKOUT_ELEMENTS_APPEARANCE,
      },
    }),
    [clientSecret],
  );

  return (
    <div
      className={cn("min-h-[calc(100vh-4rem)] py-8 sm:py-12", className)}
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
            <CheckoutElementsProvider stripe={stripePromise} options={options}>
              <CheckoutPayBody summary={summary} />
            </CheckoutElementsProvider>
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
