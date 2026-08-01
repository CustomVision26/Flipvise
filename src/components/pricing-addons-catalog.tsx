"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SignInButton, useAuth } from "@clerk/nextjs";
import {
  cancelOwnAddonRenewalAction,
  createAddonCheckoutSessionAction,
} from "@/actions/addons";
import { PricingBillingPeriodToggle } from "@/components/pricing-billing-period-toggle";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import type { PricingBillingPeriod } from "@/lib/pricing-billing-period";
import { useKeepClerkAuthButtonsMounted } from "@/lib/use-clerk-modal-teardown";

export type PricingAddonCard = {
  key: string;
  name: string;
  description: string;
  marketingBlurb: string;
  eligible: boolean;
  entitled: boolean;
  entitlementSource: "stripe" | "admin" | "team" | null;
  canPurchase: boolean;
  stripePriceConfigured: boolean;
  yearlyPriceConfigured?: boolean;
  /** e.g. "$9.99/mo" from Stripe */
  monthlyPriceLabel?: string | null;
  /** Actual yearly charge, e.g. "$99.00/yr" */
  yearlyPriceLabel?: string | null;
  /** Effective monthly rate when billed yearly, e.g. "$8.25/mo" */
  yearlyMonthlyEquivalentLabel?: string | null;
  /** Stripe-billed add-on can cancel renewal without touching the base plan. */
  canCancelRenewal?: boolean;
  renewalCancelScheduled?: boolean;
  accessUntilLabel?: string | null;
};

type PricingAddonsCatalogProps = {
  addons: PricingAddonCard[];
  signedIn: boolean;
  effectivePlanSlug: string | null;
};

export function PricingAddonsCatalog({
  addons,
  signedIn,
  effectivePlanSlug,
}: PricingAddonsCatalogProps) {
  const router = useRouter();
  const { isLoaded: authLoaded } = useAuth();
  const keepMounted = useKeepClerkAuthButtonsMounted();
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);
  const [cancelPendingKey, setCancelPendingKey] = React.useState<string | null>(
    null,
  );
  const [periodByKey, setPeriodByKey] = React.useState<
    Record<string, PricingBillingPeriod>
  >({});
  const [error, setError] = React.useState<string | null>(null);
  const [cancelNoteByKey, setCancelNoteByKey] = React.useState<
    Record<string, string>
  >({});

  function periodFor(addonKey: string): PricingBillingPeriod {
    return periodByKey[addonKey] ?? "monthly";
  }

  async function handlePurchase(addonKey: string) {
    setError(null);
    setPendingKey(addonKey);
    try {
      const period = periodFor(addonKey);
      const result = await createAddonCheckoutSessionAction({ addonKey, period });
      router.push(
        `/pricing/add-ons/pay?session_id=${encodeURIComponent(result.sessionId)}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start add-on checkout.");
    } finally {
      setPendingKey(null);
    }
  }

  async function handleCancelRenewal(addonKey: string) {
    setError(null);
    setCancelPendingKey(addonKey);
    try {
      const result = await cancelOwnAddonRenewalAction({ addonKey });
      const label = new Date(result.periodEndIso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      setCancelNoteByKey((prev) => ({
        ...prev,
        [addonKey]: `Renewal canceled. You keep access until ${label}. Your plan subscription is unchanged.`,
      }));
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not cancel add-on renewal.",
      );
    } finally {
      setCancelPendingKey(null);
    }
  }

  if (addons.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">
        No add-ons are published right now.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="grid gap-4 sm:grid-cols-2">
        {addons.map((addon) => {
          const pending = pendingKey === addon.key;
          const period = periodFor(addon.key);
          const showYearlyToggle = Boolean(
            addon.yearlyPriceConfigured && addon.yearlyPriceLabel,
          );
          const priceLabel =
            period === "yearly" && addon.yearlyPriceLabel
              ? addon.yearlyPriceLabel
              : addon.monthlyPriceLabel;

          let ctaLabel = "Get add-on";
          let disabled = false;
          let tip = "Start billing for this add-on";
          let useSignInCta = false;

          if (!signedIn) {
            ctaLabel = "Sign in to purchase";
            disabled = false;
            useSignInCta = true;
            tip = "Sign in to purchase this add-on";
          } else if (addon.entitled) {
            ctaLabel =
              addon.entitlementSource === "admin"
                ? "Included (admin)"
                : addon.entitlementSource === "team"
                  ? "Included (team)"
                  : "Already owned";
            disabled = true;
            tip =
              addon.renewalCancelScheduled || cancelNoteByKey[addon.key]
                ? "Add-on renewal is canceled; access continues until the date shown"
                : "You already have access to this add-on";
          } else if (!addon.eligible) {
            ctaLabel = "Not eligible";
            disabled = true;
            tip = `Requires an eligible plan (yours: ${effectivePlanSlug ?? "free"})`;
          } else if (!addon.canPurchase || !addon.stripePriceConfigured) {
            ctaLabel = "Unavailable";
            disabled = true;
            tip = "This add-on is not available for self-serve purchase yet";
          }

          const purchaseButton = (
            <Button
              type="button"
              disabled={disabled || pending || (useSignInCta && !authLoaded)}
              onClick={
                useSignInCta ? undefined : () => void handlePurchase(addon.key)
              }
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                ctaLabel
              )}
            </Button>
          );

          return (
            <li
              key={addon.key}
              className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card/40 p-5"
            >
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight">{addon.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {addon.marketingBlurb || addon.description}
                </p>
              </div>

              <div className="space-y-3">
                {priceLabel ? (
                  <div className="space-y-0.5">
                    <p className="text-2xl font-semibold tracking-tight text-foreground">
                      {priceLabel}
                    </p>
                    {period === "yearly" &&
                    addon.yearlyMonthlyEquivalentLabel ? (
                      <p className="text-xs text-muted-foreground">
                        {addon.yearlyMonthlyEquivalentLabel} when billed
                        annually
                      </p>
                    ) : null}
                  </div>
                ) : addon.stripePriceConfigured ? (
                  <p className="text-sm text-muted-foreground">Price unavailable</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Price not configured
                  </p>
                )}

                {showYearlyToggle ? (
                  <div className="space-y-1.5">
                    <PricingBillingPeriodToggle
                      period={period}
                      onPeriodChange={(next) =>
                        setPeriodByKey((prev) => ({
                          ...prev,
                          [addon.key]: next,
                        }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      {period === "yearly"
                        ? addon.yearlyPriceLabel
                          ? `You are charged ${addon.yearlyPriceLabel} for the year`
                          : "Billed yearly"
                        : addon.monthlyPriceLabel
                          ? `Billed monthly · ${addon.monthlyPriceLabel}`
                          : "Billed monthly"}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger render={<span className="inline-flex w-fit" />}>
                      {useSignInCta && authLoaded && keepMounted ? (
                        <SignInButton
                          mode="modal"
                          forceRedirectUrl="/pricing/add-ons"
                        >
                          {purchaseButton}
                        </SignInButton>
                      ) : (
                        purchaseButton
                      )}
                    </TooltipTrigger>
                    <TooltipContent>{tip}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {addon.entitled &&
                addon.entitlementSource === "stripe" &&
                (addon.canCancelRenewal ||
                  addon.renewalCancelScheduled ||
                  cancelNoteByKey[addon.key]) ? (
                  <div className="space-y-1.5">
                    {addon.canCancelRenewal &&
                    !addon.renewalCancelScheduled &&
                    !cancelNoteByKey[addon.key] ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-fit"
                        disabled={cancelPendingKey === addon.key}
                        onClick={() => void handleCancelRenewal(addon.key)}
                      >
                        {cancelPendingKey === addon.key ? (
                          <Loader2
                            className="size-4 animate-spin"
                            aria-hidden
                          />
                        ) : (
                          "Cancel add-on renewal"
                        )}
                      </Button>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {cancelNoteByKey[addon.key] ??
                        (addon.renewalCancelScheduled
                          ? `Renewal canceled. You keep access${
                              addon.accessUntilLabel
                                ? ` until ${addon.accessUntilLabel}`
                                : ""
                            }. Your plan subscription is unchanged.`
                          : "Cancels only this add-on’s renewal — your plan keeps renewing as usual.")}
                    </p>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
