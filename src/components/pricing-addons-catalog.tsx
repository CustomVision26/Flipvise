"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { createAddonCheckoutSessionAction } from "@/actions/addons";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
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
  /** e.g. "$99.00/yr" from Stripe */
  yearlyPriceLabel?: string | null;
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
  const [periodByKey, setPeriodByKey] = React.useState<
    Record<string, "monthly" | "yearly">
  >({});
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function handlePurchase(addonKey: string) {
    setError(null);
    setSuccess(null);
    setPendingKey(addonKey);
    try {
      const period = periodByKey[addonKey] ?? "monthly";
      const result = await createAddonCheckoutSessionAction({ addonKey, period });
      if (result.mode === "attached") {
        setSuccess("Add-on added to your subscription.");
        router.refresh();
        return;
      }
      router.push(
        `/pricing/add-ons/pay?session_id=${encodeURIComponent(result.sessionId)}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start add-on checkout.");
    } finally {
      setPendingKey(null);
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
          const period = periodByKey[addon.key] ?? "monthly";
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
            tip = "You already have access to this add-on";
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
              className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card/40 p-5"
            >
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight">{addon.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {addon.marketingBlurb || addon.description}
                </p>
              </div>

              {priceLabel ? (
                <p className="text-2xl font-semibold tracking-tight text-foreground">
                  {priceLabel}
                </p>
              ) : addon.stripePriceConfigured ? (
                <p className="text-sm text-muted-foreground">Price unavailable</p>
              ) : (
                <p className="text-sm text-muted-foreground">Price not configured</p>
              )}

              {showYearlyToggle ? (
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    className={
                      period === "monthly"
                        ? "font-semibold text-foreground underline"
                        : "text-muted-foreground"
                    }
                    onClick={() =>
                      setPeriodByKey((prev) => ({ ...prev, [addon.key]: "monthly" }))
                    }
                  >
                    Monthly
                    {addon.monthlyPriceLabel
                      ? ` · ${addon.monthlyPriceLabel}`
                      : ""}
                  </button>
                  <button
                    type="button"
                    className={
                      period === "yearly"
                        ? "font-semibold text-foreground underline"
                        : "text-muted-foreground"
                    }
                    onClick={() =>
                      setPeriodByKey((prev) => ({ ...prev, [addon.key]: "yearly" }))
                    }
                  >
                    Yearly
                    {addon.yearlyPriceLabel
                      ? ` · ${addon.yearlyPriceLabel}`
                      : ""}
                  </button>
                </div>
              ) : null}

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex w-fit" />}>
                    {useSignInCta && authLoaded && keepMounted ? (
                      <SignInButton mode="modal" forceRedirectUrl="/pricing/add-ons">
                        {purchaseButton}
                      </SignInButton>
                    ) : (
                      purchaseButton
                    )}
                  </TooltipTrigger>
                  <TooltipContent>{tip}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </li>
          );
        })}
      </ul>
      {success ? (
        <p className="text-sm text-emerald-400" role="status">
          {success}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
