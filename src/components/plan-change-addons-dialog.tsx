"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { getPlanChangeSelectedAddonLineAction } from "@/actions/plan-change-checkout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type {
  PlanChangeLockedAddonOffer,
  PlanChangeSelectedAddonLine,
} from "@/lib/plan-change-locked-addons";
import type { PlanChangeProrationPreview } from "@/lib/plan-change-proration-preview";
import type { PricingBillingPeriod } from "@/lib/pricing-billing-period";
import { formatCentsMoney } from "@/lib/money-math";
import { formatPlanMoney } from "@/lib/pricing-period-display";
import { cn } from "@/lib/utils";

const NONE_VALUE = "__none__";

type PlanChangeAddonsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offers: PlanChangeLockedAddonOffer[];
  period: PricingBillingPeriod;
  targetPlanLabel: string;
  planRecurringLabel: string;
  prorationPreview: PlanChangeProrationPreview | null;
  previewLoading: boolean;
  pending: boolean;
  onSkip: () => void;
  onContinue: (addonKey: string | null) => void;
};

function addonPriceLabel(
  offer: PlanChangeLockedAddonOffer,
  period: PricingBillingPeriod,
): string | null {
  if (period === "yearly") {
    return offer.yearlyLabel ?? offer.monthlyLabel;
  }
  return offer.monthlyLabel ?? offer.yearlyLabel;
}

function periodConfigured(
  offer: PlanChangeLockedAddonOffer,
  period: PricingBillingPeriod,
): boolean {
  return period === "yearly" ? offer.yearlyConfigured : offer.monthlyConfigured;
}

export function PlanChangeAddonsDialog({
  open,
  onOpenChange,
  offers,
  period,
  targetPlanLabel,
  planRecurringLabel,
  prorationPreview,
  previewLoading,
  pending,
  onSkip,
  onContinue,
}: PlanChangeAddonsDialogProps) {
  const [selectedKey, setSelectedKey] = useState<string>(NONE_VALUE);
  const [acknowledged, setAcknowledged] = useState(false);
  const [addonLine, setAddonLine] = useState<PlanChangeSelectedAddonLine | null>(
    null,
  );
  const [addonLineLoading, setAddonLineLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedKey(NONE_VALUE);
    setAcknowledged(false);
    setAddonLine(null);
  }, [open]);

  useEffect(() => {
    if (!open || selectedKey === NONE_VALUE) {
      setAddonLine(null);
      setAddonLineLoading(false);
      return;
    }
    let cancelled = false;
    setAddonLineLoading(true);
    getPlanChangeSelectedAddonLineAction({
      addonKey: selectedKey,
      period,
    })
      .then((line) => {
        if (!cancelled) setAddonLine(line);
      })
      .catch(() => {
        if (!cancelled) setAddonLine(null);
      })
      .finally(() => {
        if (!cancelled) setAddonLineLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, selectedKey, period]);

  const selectedOffer =
    selectedKey === NONE_VALUE
      ? null
      : (offers.find((o) => o.key === selectedKey) ?? null);

  const requiresAck =
    selectedOffer != null ||
    (prorationPreview != null && prorationPreview.amountDueCents !== 0);

  const fallbackPriceLabel = selectedOffer
    ? addonPriceLabel(selectedOffer, period)
    : null;

  const canContinue =
    !pending &&
    !previewLoading &&
    !addonLineLoading &&
    (!requiresAck || acknowledged) &&
    (selectedOffer == null || periodConfigured(selectedOffer, period));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Optional add-ons</DialogTitle>
          <DialogDescription>
            Unlock premium features with your {targetPlanLabel} plan change. Only
            locked add-ons you do not already have are listed. You can skip and
            add them later from Pricing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <RadioGroup
            value={selectedKey}
            onValueChange={(value) => {
              setSelectedKey(value ?? NONE_VALUE);
              setAcknowledged(false);
            }}
            className="gap-2"
          >
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-background/40 px-3 py-3",
                selectedKey === NONE_VALUE && "border-primary/50 bg-primary/5",
              )}
            >
              <RadioGroupItem value={NONE_VALUE} className="mt-0.5" />
              <span className="space-y-0.5 text-sm">
                <span className="block font-medium text-foreground">
                  No add-on for now
                </span>
                <span className="block text-muted-foreground">
                  Continue with the plan change only.
                </span>
              </span>
            </label>

            {offers.map((offer) => {
              const price = addonPriceLabel(offer, period);
              const available = periodConfigured(offer, period);
              return (
                <label
                  key={offer.key}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-background/40 px-3 py-3",
                    selectedKey === offer.key && "border-primary/50 bg-primary/5",
                    !available && "opacity-60",
                  )}
                >
                  <RadioGroupItem
                    value={offer.key}
                    disabled={!available}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1 space-y-1 text-sm">
                    <span className="flex flex-wrap items-center gap-2">
                      <Lock
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="font-medium text-foreground">
                        {offer.name}
                      </span>
                      {price ? (
                        <span className="tabular-nums text-muted-foreground">
                          {price}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-400/90">
                          Not available for {period} billing
                        </span>
                      )}
                    </span>
                    {offer.blurb ? (
                      <span className="block text-muted-foreground">
                        {offer.blurb}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </RadioGroup>

          <div className="space-y-2 rounded-lg border border-border/70 bg-card/40 px-3 py-3 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Breakdown
            </p>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">
                {targetPlanLabel} (new recurring)
              </span>
              <span className="shrink-0 tabular-nums text-foreground">
                {planRecurringLabel}
              </span>
            </div>
            {previewLoading ? (
              <p className="text-xs text-muted-foreground">
                Calculating plan proration…
              </p>
            ) : prorationPreview ? (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  Plan change estimated due today
                </span>
                <span className="shrink-0 font-medium tabular-nums text-foreground">
                  {formatCentsMoney(
                    prorationPreview.amountDueCents,
                    prorationPreview.currency,
                  )}
                </span>
              </div>
            ) : (
              <p className="text-xs text-amber-400/90">
                Plan proration preview unavailable — Stripe will show the final
                amount on the next step.
              </p>
            )}
            {selectedOffer ? (
              <>
                <div className="flex justify-between gap-3 border-t border-border/50 pt-2">
                  <span className="text-muted-foreground">
                    {addonLine?.description ?? `${selectedOffer.name} add-on`}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5 tabular-nums text-foreground">
                    {addonLineLoading ? (
                      <span className="text-xs text-muted-foreground">
                        Calculating…
                      </span>
                    ) : addonLine ? (
                      <>
                        {addonLine.isProrated &&
                        addonLine.listPriceCents > addonLine.amountCents ? (
                          <span className="text-xs text-muted-foreground line-through">
                            {formatCentsMoney(
                              addonLine.listPriceCents,
                              addonLine.currency,
                            )}
                          </span>
                        ) : null}
                        <span>
                          {formatCentsMoney(
                            addonLine.amountCents,
                            addonLine.currency,
                          )}
                        </span>
                      </>
                    ) : (
                      <span>{fallbackPriceLabel ?? "—"}</span>
                    )}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {addonLine?.isProrated
                    ? "First add-on charge is prorated to your plan renewal, then renews at list price. Charged after this plan change succeeds."
                    : "After your plan change succeeds, you will continue to add-on checkout."}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Select an add-on to include it after the plan change, or continue
                without one.
              </p>
            )}
          </div>

          {requiresAck ? (
            <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-background/40 px-3 py-3">
              <Checkbox
                id="plan-change-addon-ack"
                checked={acknowledged}
                onCheckedChange={(checked) =>
                  setAcknowledged(checked === true)
                }
                className="mt-0.5"
              />
              <Label
                htmlFor="plan-change-addon-ack"
                className="cursor-pointer text-sm font-normal leading-relaxed text-muted-foreground"
              >
                I understand this billing breakdown
                {selectedOffer
                  ? " (plan proration now, then separate add-on checkout)"
                  : ""}
                .
              </Label>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onSkip()}
          >
            Skip
          </Button>
          <Button
            type="button"
            disabled={!canContinue}
            onClick={() =>
              onContinue(selectedOffer ? selectedOffer.key : null)
            }
          >
            {pending
              ? "Continuing…"
              : selectedOffer
                ? "Continue with add-on"
                : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Helper for dialog recurring-rate copy — keep formatting next to checkout step. */
export function formatPlanChangeRecurringLabel(input: {
  period: PricingBillingPeriod;
  discountedPeriodicRate: number;
  discountedAnnualTotal: number | null;
}): string {
  if (input.period === "yearly" && input.discountedAnnualTotal != null) {
    return `$${formatPlanMoney(input.discountedAnnualTotal)} / year`;
  }
  return `$${formatPlanMoney(input.discountedPeriodicRate)} / month`;
}
