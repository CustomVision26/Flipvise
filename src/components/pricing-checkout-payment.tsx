"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CreditCard, Tag } from "lucide-react";
import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SlideToSubmitButton } from "@/components/slide-to-submit-button";
import {
  WORLD_COUNTRY_NAMES,
  countryCodeFromName,
} from "@/data/world-countries";
import type { CheckoutPromoDisplay } from "@/lib/checkout-promo-display-types";
import type { CheckoutSessionAmountsMajor } from "@/lib/stripe-checkout-session-amounts";
import type { CheckoutSavedMailingAddress } from "@/lib/checkout-saved-mailing-address";
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

function countryNameFromCode(countryCode: string): string | null {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) ?? null;
  } catch {
    return null;
  }
}

type ManualBillingAddress = {
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  countryName: string;
};

function emptyManualBillingAddress(
  saved: CheckoutSavedMailingAddress | null,
): ManualBillingAddress {
  if (!saved) {
    return { line1: "", city: "", state: "", postalCode: "", countryName: "" };
  }
  return {
    line1: saved.address.line1,
    city: saved.address.city,
    state: saved.address.state ?? "",
    postalCode: saved.address.postal_code ?? "",
    countryName: countryNameFromCode(saved.address.country) ?? "",
  };
}

export type PricingCheckoutSummary = {
  planLabel: string;
  period: PricingBillingPeriod;
  customerEmail: string | null;
  campaignLabel: string | null;
  promo: CheckoutPromoDisplay | null;
  isTrial: boolean;
  trialDays: number | null;
  /** List monthly rate after trial (major units). */
  monthlyRateAfterTrial: number | null;
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
  const periodLabel = summary.isTrial
    ? "Monthly billing after trial"
    : isYearly
      ? "Annual billing"
      : "Monthly billing";
  const amounts = summary.stripeAmounts;

  const subtotal = amounts?.subtotalMajor ?? null;
  const discount = summary.isTrial ? null : amounts?.discountMajor ?? null;
  const totalDue = summary.isTrial
    ? 0
    : liveTotalMajor ?? amounts?.totalDueMajor ?? null;

  const impliedTax =
    !summary.isTrial && totalDue != null && subtotal != null
      ? roundMoney(Math.max(0, totalDue - subtotal + (discount ?? 0)))
      : summary.isTrial
        ? null
        : (amounts?.taxMajor ?? null);

  const monthlyEquivalent =
    !summary.isTrial && isYearly && totalDue != null
      ? roundMoney(totalDue / 12)
      : null;

  const monthlyAfterTrial =
    summary.monthlyRateAfterTrial ??
    (!summary.isTrial && isYearly && subtotal != null ? roundMoney(subtotal / 12) : subtotal);

  return (
    <section className="space-y-4">
      <SectionLabel>{summary.isTrial ? "Free trial" : "Order summary"}</SectionLabel>
      <div className="space-y-1">
        <h1
          className="font-serif text-xl font-normal tracking-tight text-[#1a2332] sm:text-[1.35rem]"
          style={{ fontFamily: 'Georgia, "Noto Serif", serif' }}
        >
          {summary.isTrial
            ? `Start your ${summary.planLabel} free trial`
            : `Subscribe to ${summary.planLabel}`}
        </h1>
        <p className="text-sm text-[#6b7280]">{periodLabel}</p>
      </div>

      {summary.isTrial && summary.trialDays != null && summary.trialDays > 0 ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm leading-relaxed text-[#3d4f46]">
          You are about to start the{" "}
          <span className="font-medium text-[#1a2332]">{summary.planLabel}</span> free trial.
          Add your payment method below — you will not be charged until your{" "}
          {summary.trialDays}-day trial ends.
        </div>
      ) : null}

      {!summary.isTrial && summary.campaignLabel ? (
        <Badge className="border-amber-300/50 bg-amber-50 font-normal text-amber-950 hover:bg-amber-50">
          {summary.campaignLabel}
        </Badge>
      ) : null}

      <div className="space-y-2 rounded-md border border-[#e8ebf0] bg-[#fafbfc] px-4 py-3.5 text-sm">
        {summary.isTrial && summary.trialDays != null && summary.trialDays > 0 ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-[#6b7280]">
                {summary.planLabel} · {summary.trialDays}-day trial
              </span>
              <span className="font-serif text-2xl font-semibold tabular-nums text-[#1a2332]">
                $0
              </span>
            </div>
            {monthlyAfterTrial != null ? (
              <p className="text-[#6b7280]">
                Then ${formatPlanMoney(monthlyAfterTrial)} / month after trial
              </p>
            ) : null}
            <Separator className="bg-[#e0e4e8]" />
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="font-medium text-[#1a2332]">Total due today</span>
              <span className="font-serif text-2xl font-semibold tabular-nums text-[#1a2332]">
                $0
              </span>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      {monthlyEquivalent != null ? (
        <p className="text-sm text-[#6b7280]">
          ${formatPlanMoney(monthlyEquivalent)} / month when billed annually
        </p>
      ) : null}

      {!summary.isTrial && summary.promo ? <PromoPanel promo={summary.promo} /> : null}
    </section>
  );
}

function CheckoutPayBody({
  summary,
  savedMailingAddress,
}: {
  summary: PricingCheckoutSummary;
  savedMailingAddress: CheckoutSavedMailingAddress | null;
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
        isTrial={summary.isTrial}
        planLabel={summary.planLabel}
        trialDays={summary.trialDays}
        savedMailingAddress={savedMailingAddress}
      />
    </>
  );
}

function CheckoutPaymentFields({
  customerEmail,
  checkoutState,
  isTrial,
  planLabel,
  trialDays,
  savedMailingAddress,
}: {
  customerEmail: string | null;
  checkoutState: ReturnType<typeof useCheckoutElements>;
  isTrial: boolean;
  planLabel: string;
  trialDays: number | null;
  savedMailingAddress: CheckoutSavedMailingAddress | null;
}) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useMailingAsBilling, setUseMailingAsBilling] = useState(false);
  const [isApplyingBillingAddress, setIsApplyingBillingAddress] = useState(false);
  const [cardName, setCardName] = useState(savedMailingAddress?.name ?? "");
  const [manualAddress, setManualAddress] = useState<ManualBillingAddress>(() =>
    emptyManualBillingAddress(savedMailingAddress),
  );

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
  const slideLabel = isTrial
    ? trialDays != null && trialDays > 0
      ? `Slide to start ${trialDays}-day trial`
      : `Slide to start free trial`
    : stripeTotal
      ? `Slide to subscribe — ${stripeTotal}`
      : "Slide to subscribe";

  function mailingAddressPayload(name: string) {
    if (!savedMailingAddress) return null;
    return {
      name: name.trim() || null,
      address: {
        line1: savedMailingAddress.address.line1,
        ...(savedMailingAddress.address.line2
          ? { line2: savedMailingAddress.address.line2 }
          : {}),
        city: savedMailingAddress.address.city,
        ...(savedMailingAddress.address.state
          ? { state: savedMailingAddress.address.state }
          : {}),
        ...(savedMailingAddress.address.postal_code
          ? { postal_code: savedMailingAddress.address.postal_code }
          : {}),
        country: savedMailingAddress.address.country,
      },
    };
  }

  function manualAddressPayload(name: string) {
    const country = countryCodeFromName(manualAddress.countryName);
    if (!country) return null;
    const line1 = manualAddress.line1.trim();
    const city = manualAddress.city.trim();
    if (!line1 || !city) return null;

    return {
      name: name.trim() || null,
      address: {
        line1,
        city,
        country,
        ...(manualAddress.state.trim() ? { state: manualAddress.state.trim() } : {}),
        ...(manualAddress.postalCode.trim()
          ? { postal_code: manualAddress.postalCode.trim() }
          : {}),
      },
    };
  }

  async function applyBillingAddressPayload(
    payload: NonNullable<ReturnType<typeof mailingAddressPayload>>,
    fallbackMessage: string,
  ): Promise<boolean> {
    setIsApplyingBillingAddress(true);
    try {
      const result = await checkout.updateBillingAddress(payload);
      if (result.type === "error") {
        setErrorMessage(result.error.message || fallbackMessage);
        return false;
      }
      return true;
    } catch {
      setErrorMessage(fallbackMessage);
      return false;
    } finally {
      setIsApplyingBillingAddress(false);
    }
  }

  async function applyCurrentBillingAddress(name: string): Promise<boolean> {
    if (useMailingAsBilling) {
      const payload = mailingAddressPayload(name);
      if (!payload) {
        setErrorMessage(
          "Could not apply your Flipvise mailing address. Enter the billing address manually.",
        );
        return false;
      }
      return applyBillingAddressPayload(
        payload,
        "Could not apply your Flipvise mailing address. Enter the billing address manually.",
      );
    }

    const payload = manualAddressPayload(name);
    if (!payload) {
      setErrorMessage("Enter a complete billing address.");
      return false;
    }
    return applyBillingAddressPayload(
      payload,
      "Could not update the billing address. Check the fields and try again.",
    );
  }

  const manualAddressComplete = Boolean(
    manualAddress.line1.trim() &&
      manualAddress.city.trim() &&
      countryCodeFromName(manualAddress.countryName),
  );

  async function handleSubscribe() {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const trimmedName = cardName.trim();
      if (!trimmedName) {
        setErrorMessage("Enter the name on the card.");
        setIsSubmitting(false);
        return;
      }

      // Automatic tax forbids billingAddress on confirm(); use updateBillingAddress only.
      const applied = await applyCurrentBillingAddress(trimmedName);
      if (!applied) {
        setIsSubmitting(false);
        return;
      }

      const result = await checkout.confirm();

      if (result.type === "error") {
        setErrorMessage(result.error.message);
        setIsSubmitting(false);
        return;
      }

      // Session already has return_url from creation; fall back if Stripe does not navigate.
      const sessionId = result.session.id;
      window.location.assign(
        sessionId
          ? `/dashboard?checkout=success&session_id=${encodeURIComponent(sessionId)}`
          : "/dashboard?checkout=success",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Payment could not be completed. Please try again.",
      );
      setIsSubmitting(false);
    }
  }

  async function handleUseMailingAsBillingChange(checked: boolean) {
    setErrorMessage(null);
    if (!checked) {
      setUseMailingAsBilling(false);
      return;
    }
    if (!savedMailingAddress) return;

    const nextCardName = cardName.trim() || savedMailingAddress.name || "";
    const payload = mailingAddressPayload(nextCardName);
    if (!payload) return;

    setCardName(nextCardName);
    setUseMailingAsBilling(true);
    const applied = await applyBillingAddressPayload(
      payload,
      "Could not apply your Flipvise mailing address. Enter the billing address manually.",
    );
    if (!applied) {
      setUseMailingAsBilling(false);
    }
  }

  async function handleCardNameBlur() {
    const trimmedName = cardName.trim();
    if (!trimmedName) return;
    if (useMailingAsBilling) {
      await applyCurrentBillingAddress(trimmedName);
      return;
    }
    if (manualAddressComplete) {
      await applyCurrentBillingAddress(trimmedName);
    }
  }

  return (
    <section className="space-y-5">
      <SectionLabel>Payment details</SectionLabel>

      {customerEmail ? (
        <div className="space-y-2">
          <Label htmlFor="checkout-email" className="text-sm font-medium text-[#30313d]">
            Account email
          </Label>
          <Input
            id="checkout-email"
            readOnly
            value={customerEmail}
            className="h-11 border-[#d0d7e2] bg-white font-normal text-[#30313d] shadow-none"
          />
          <p className="text-xs leading-relaxed text-[#6b7280]">
            Your signed-in Flipvise account. Receipts and billing notices are sent here.
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-[#30313d]">Payment method</p>
          <p className="text-xs leading-relaxed text-[#6b7280]">
            Card details for the person or business paying for this subscription.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-[#e8ebf0] bg-[#fafbfc] px-3 py-2 text-sm text-[#30313d]">
          <CreditCard className="size-4 text-[#6b7280]" aria-hidden />
          <span>Card</span>
        </div>
        <PaymentElement
          options={{
            fields: {
              billingDetails: {
                // Name/address come from updateBillingAddress().
                name: "never",
                address: "never",
              },
            },
          }}
        />
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-[#30313d]">Billing address</p>
          <p className="text-xs leading-relaxed text-[#6b7280]">
            {useMailingAsBilling
              ? "Your Flipvise mailing address will be used for billing verification and tax. Enter the name as it appears on the card."
              : "Enter the name and address on the card or bank account you are using above. These are used to verify your payment method and calculate tax where applicable."}
            {!useMailingAsBilling && savedMailingAddress
              ? " If that matches your Flipvise mailing address from Account Details, you can select it below."
              : null}
          </p>
        </div>
        {savedMailingAddress ? (
          <div className="flex items-start gap-2.5 rounded-md border border-[#e8ebf0] bg-[#fafbfc] px-3 py-2.5">
            <Checkbox
              id="checkout-same-as-mailing"
              checked={useMailingAsBilling}
              disabled={isApplyingBillingAddress || isSubmitting}
              onCheckedChange={(value) => {
                void handleUseMailingAsBillingChange(value === true);
              }}
              className="mt-0.5 border-[#d0d7e2] bg-white data-checked:border-[#1a2332] data-checked:bg-[#1a2332] data-checked:text-white"
            />
            <div className="min-w-0 space-y-1">
              <Label
                htmlFor="checkout-same-as-mailing"
                className="cursor-pointer text-sm font-medium text-[#30313d]"
              >
                Same as my Flipvise mailing address
              </Label>
              <p className="whitespace-pre-line text-xs leading-relaxed text-[#6b7280]">
                {savedMailingAddress.displayLines}
              </p>
              {isApplyingBillingAddress ? (
                <p className="text-xs text-[#6b7280]">Applying address…</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="checkout-card-name" className="text-sm font-medium text-[#30313d]">
            Card Name
          </Label>
          <Input
            id="checkout-card-name"
            value={cardName}
            onChange={(event) => setCardName(event.target.value)}
            onBlur={() => {
              void handleCardNameBlur();
            }}
            autoComplete="cc-name"
            placeholder="Name on card"
            disabled={isApplyingBillingAddress || isSubmitting}
            className="h-11 border-[#d0d7e2] bg-white font-normal text-[#30313d] shadow-none"
          />
        </div>

        {!useMailingAsBilling ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label
                htmlFor="checkout-billing-country"
                className="text-sm font-medium text-[#30313d]"
              >
                Country or region
              </Label>
              <Select
                value={manualAddress.countryName ? manualAddress.countryName : null}
                disabled={isApplyingBillingAddress || isSubmitting}
                itemToStringLabel={(value) => value}
                onValueChange={(next) => {
                  setManualAddress((prev) => ({
                    ...prev,
                    countryName: next ?? "",
                  }));
                }}
              >
                <SelectTrigger
                  id="checkout-billing-country"
                  className="h-11 w-full border-[#d0d7e2] bg-white font-normal text-[#30313d] shadow-none"
                >
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {WORLD_COUNTRY_NAMES.map((country) => (
                    <SelectItem key={country} value={country} label={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="checkout-billing-line1"
                className="text-sm font-medium text-[#30313d]"
              >
                Address
              </Label>
              <Input
                id="checkout-billing-line1"
                value={manualAddress.line1}
                onChange={(event) =>
                  setManualAddress((prev) => ({
                    ...prev,
                    line1: event.target.value,
                  }))
                }
                autoComplete="address-line1"
                placeholder="Address"
                disabled={isApplyingBillingAddress || isSubmitting}
                className="h-11 border-[#d0d7e2] bg-white font-normal text-[#30313d] shadow-none"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label
                  htmlFor="checkout-billing-city"
                  className="text-sm font-medium text-[#30313d]"
                >
                  City
                </Label>
                <Input
                  id="checkout-billing-city"
                  value={manualAddress.city}
                  onChange={(event) =>
                    setManualAddress((prev) => ({
                      ...prev,
                      city: event.target.value,
                    }))
                  }
                  autoComplete="address-level2"
                  placeholder="City"
                  disabled={isApplyingBillingAddress || isSubmitting}
                  className="h-11 border-[#d0d7e2] bg-white font-normal text-[#30313d] shadow-none"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="checkout-billing-state"
                  className="text-sm font-medium text-[#30313d]"
                >
                  State / province
                </Label>
                <Input
                  id="checkout-billing-state"
                  value={manualAddress.state}
                  onChange={(event) =>
                    setManualAddress((prev) => ({
                      ...prev,
                      state: event.target.value,
                    }))
                  }
                  autoComplete="address-level1"
                  placeholder="State or province"
                  disabled={isApplyingBillingAddress || isSubmitting}
                  className="h-11 border-[#d0d7e2] bg-white font-normal text-[#30313d] shadow-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="checkout-billing-postal"
                className="text-sm font-medium text-[#30313d]"
              >
                Postal code
              </Label>
              <Input
                id="checkout-billing-postal"
                value={manualAddress.postalCode}
                onChange={(event) =>
                  setManualAddress((prev) => ({
                    ...prev,
                    postalCode: event.target.value,
                  }))
                }
                autoComplete="postal-code"
                placeholder="Postal code"
                disabled={isApplyingBillingAddress || isSubmitting}
                className="h-11 border-[#d0d7e2] bg-white font-normal text-[#30313d] shadow-none"
              />
            </div>
          </div>
        ) : null}
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
          {isTrial ? "Start free trial" : "Complete subscription"}
        </p>
        <SlideToSubmitButton
          label={slideLabel}
          disabled={
            isSubmitting ||
            isApplyingBillingAddress ||
            !cardName.trim() ||
            (!useMailingAsBilling && !manualAddressComplete) ||
            !checkout.canConfirm
          }
          pending={isSubmitting}
          onSubmit={handleSubscribe}
          variant="checkout"
        />
        <p className="text-center text-xs leading-relaxed text-[#6b7280]">
          {isTrial ? (
            <>
              By starting your {planLabel} trial, you authorize Flipvise to charge you after
              the trial ends unless you cancel before then.
            </>
          ) : (
            <>
              By subscribing, you authorize Flipvise to charge you according to the terms until
              you cancel.
            </>
          )}
        </p>
      </div>
    </section>
  );
}

export function PricingCheckoutPayment({
  clientSecret,
  summary,
  backHref,
  savedMailingAddress = null,
  className,
}: {
  clientSecret: string;
  summary: PricingCheckoutSummary;
  backHref: string;
  savedMailingAddress?: CheckoutSavedMailingAddress | null;
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
              <CheckoutPayBody
                summary={summary}
                savedMailingAddress={savedMailingAddress}
              />
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
